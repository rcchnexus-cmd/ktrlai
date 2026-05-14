import { createHash } from "node:crypto";
import {
  checkUpstashFixedWindow,
  getConfiguredRateLimitProvider,
  isUpstashRateLimitConfigured,
  pingUpstashRateLimit,
} from "./_redisRateLimit.js";

const buckets = new Map();
const recordedTriggers = new Map();
const defaultWindowMs = 60 * 1000;

function readHeader(req, name) {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function sanitizeKeyPart(value) {
  return String(value || "none")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .slice(0, 140) || "none";
}

function resetAtForBucket(bucket, windowMs) {
  return new Date((bucket + 1) * windowMs).toISOString();
}

function memoryFixedWindow({ key, limit, windowMs }) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const resetAtMs = (bucket + 1) * windowMs;
  const bucketKey = `${key}:${bucket}`;
  const current = buckets.get(bucketKey) || 0;
  const next = current + 1;

  buckets.set(bucketKey, next);

  for (const storedKey of buckets.keys()) {
    if (!storedKey.endsWith(`:${bucket}`)) {
      buckets.delete(storedKey);
    }
  }

  return {
    ok: true,
    allowed: next <= limit,
    provider: "memory",
    count: next,
    limit,
    remaining: Math.max(limit - next, 0),
    resetAt: new Date(resetAtMs).toISOString(),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
  };
}

function buildRateLimitKey(req, { scope, workspaceId, actorId, userId, apiKeyPrefix, route, action }) {
  return [
    sanitizeKeyPart(scope),
    `workspace:${sanitizeKeyPart(workspaceId || "global")}`,
    `ip:${getClientIpHash(req)}`,
    actorId || userId ? `user:${sanitizeKeyPart(actorId || userId)}` : "user:none",
    apiKeyPrefix ? `key:${sanitizeKeyPart(apiKeyPrefix)}` : "key:none",
    route ? `route:${sanitizeKeyPart(route)}` : `route:${sanitizeKeyPart(req.url?.split("?")[0] || "api")}`,
    action ? `action:${sanitizeKeyPart(action)}` : "action:none",
  ].join(":");
}

export function getClientIp(req) {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  const realIp = readHeader(req, "x-real-ip");
  return String(forwardedFor || realIp || "unknown").split(",")[0].trim() || "unknown";
}

export function getClientIpHash(req) {
  return createHash("sha256").update(getClientIp(req)).digest("hex").slice(0, 32);
}

export function rateLimitExceededResponse(rateLimit, fallbackMessage = "Too many requests. Please retry shortly.") {
  return {
    ok: false,
    message: rateLimit.message || fallbackMessage,
    limit: rateLimit.limit,
    remaining: rateLimit.remaining,
    resetAt: rateLimit.resetAt,
    retryAfterSeconds: rateLimit.retryAfterSeconds,
    provider: rateLimit.provider,
  };
}

export async function checkServerRateLimit(
  req,
  {
    scope = "global",
    workspaceId = "global",
    actorId = "",
    userId = "",
    apiKeyPrefix = "",
    route = "",
    action = "",
    windowMs = defaultWindowMs,
    max = 60,
    message = "Too many requests. Please retry shortly.",
  } = {},
) {
  const key = buildRateLimitKey(req, { scope, workspaceId, actorId, userId, apiKeyPrefix, route, action });
  const limit = Math.max(1, Number(max) || 60);
  const safeWindowMs = Math.max(1000, Number(windowMs) || defaultWindowMs);
  let result;

  if (isUpstashRateLimitConfigured()) {
    const redisResult = await checkUpstashFixedWindow({ key, limit, windowMs: safeWindowMs });
    result = redisResult.ok ? redisResult : memoryFixedWindow({ key, limit, windowMs: safeWindowMs });
  } else {
    result = memoryFixedWindow({ key, limit, windowMs: safeWindowMs });
  }

  const allowed = Boolean(result.allowed);

  return {
    ok: allowed,
    allowed,
    status: allowed ? 200 : 429,
    scope,
    workspaceId,
    limit: result.limit || limit,
    remaining: result.remaining ?? 0,
    resetAt: result.resetAt || resetAtForBucket(Math.floor(Date.now() / safeWindowMs), safeWindowMs),
    retryAfterSeconds: result.retryAfterSeconds || Math.ceil(safeWindowMs / 1000),
    provider: result.provider || getConfiguredRateLimitProvider(),
    fallbackProvider: result.provider === "memory" && isUpstashRateLimitConfigured() ? "upstash" : "",
    message,
  };
}

async function updateAbuseCounter(
  supabase,
  { workspaceId, scope, ipHash, reason, metadata, windowMs = defaultWindowMs } = {},
) {
  if (!supabase || !scope) {
    return;
  }

  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString();
  const windowEnd = new Date((Math.floor(now / windowMs) + 1) * windowMs).toISOString();
  const counterKey = [scope, ipHash || "unknown", reason || "rate_limit_exceeded"].join(":").slice(0, 220);
  const counterScope = String(scope).slice(0, 120);
  const query = supabase
    .from("abuse_counters")
    .select("id, count")
    .eq("counter_key", counterKey)
    .eq("counter_scope", counterScope)
    .eq("window_start", windowStart)
    .limit(1);
  const scopedQuery = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
  const { data } = await scopedQuery.maybeSingle();

  if (data?.id) {
    await supabase
      .from("abuse_counters")
      .update({
        count: Number(data.count || 0) + 1,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return;
  }

  await supabase.from("abuse_counters").insert({
    workspace_id: workspaceId || null,
    counter_key: counterKey,
    counter_scope: counterScope,
    count: 1,
    window_start: windowStart,
    window_end: windowEnd,
    metadata,
  });
}

export async function recordRateLimitTrigger(
  supabase,
  {
    workspaceId = null,
    scope,
    ipHash = "pending-server-hash",
    reason,
    metadata = {},
    windowMs = defaultWindowMs,
  } = {},
) {
  if (!supabase || !scope) {
    return { ok: false };
  }

  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const triggerKey = [scope, workspaceId || "platform", ipHash || "unknown", reason || "rate_limit_exceeded", bucket].join(":");

  if (recordedTriggers.has(triggerKey)) {
    return { ok: true, skipped: true };
  }

  recordedTriggers.set(triggerKey, true);

  for (const storedKey of recordedTriggers.keys()) {
    if (!storedKey.endsWith(`:${bucket}`)) {
      recordedTriggers.delete(storedKey);
    }
  }

  const safeMetadata = {
    ...metadata,
    provider: metadata.provider || getConfiguredRateLimitProvider(),
    window_ms: windowMs,
  };

  const { error } = await supabase.from("rate_limit_events").insert({
    workspace_id: workspaceId,
    scope,
    ip_hash: ipHash,
    reason: reason || "rate_limit_exceeded",
    metadata: safeMetadata,
  });

  try {
    await updateAbuseCounter(supabase, {
      workspaceId,
      scope,
      ipHash,
      reason,
      metadata: safeMetadata,
      windowMs,
    });
  } catch {
    // Abuse counters are operational visibility only; never fail product flows.
  }

  return { ok: !error, error };
}

export async function getRateLimitProviderStatus({ test = false } = {}) {
  const configuredProvider = getConfiguredRateLimitProvider();
  const redisConfigured = isUpstashRateLimitConfigured();
  const redisReachability = test && redisConfigured ? await pingUpstashRateLimit() : null;

  return {
    provider: configuredProvider,
    fallbackMode: configuredProvider === "memory",
    redisConfigured,
    redisReachable: redisReachability ? Boolean(redisReachability.ok) : null,
    algorithm: "fixed-window",
    windowing: "scope + workspace + ip + user/action/key where available",
  };
}
