const buckets = new Map();
const recordedTriggers = new Map();
const defaultWindowMs = 60 * 1000;

function readHeader(req, name) {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIp(req) {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  const realIp = readHeader(req, "x-real-ip");
  return String(forwardedFor || realIp || "unknown").split(",")[0].trim() || "unknown";
}

export function checkServerRateLimit(
  req,
  {
    scope = "global",
    workspaceId = "global",
    actorId = "",
    windowMs = defaultWindowMs,
    max = 60,
    message = "Too many requests. Please retry shortly."
  } = {}
) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const key = [scope, workspaceId || "global", actorId || getClientIp(req), bucket].join(":");
  const current = buckets.get(key) || 0;

  if (current >= max) {
    return {
      ok: false,
      status: 429,
      scope,
      workspaceId,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      message
    };
  }

  buckets.set(key, current + 1);

  for (const storedKey of buckets.keys()) {
    if (!storedKey.endsWith(`:${bucket}`)) {
      buckets.delete(storedKey);
    }
  }

  return {
    ok: true,
    scope,
    workspaceId,
    remaining: Math.max(max - current - 1, 0)
  };
}

export async function recordRateLimitTrigger(
  supabase,
  { workspaceId = null, scope, ipHash = "pending-server-hash", reason, metadata = {}, windowMs = defaultWindowMs } = {}
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

  const { error } = await supabase.from("rate_limit_events").insert({
    workspace_id: workspaceId,
    scope,
    ip_hash: ipHash,
    reason: reason || "rate_limit_exceeded",
    metadata
  });

  return { ok: !error, error };
}
