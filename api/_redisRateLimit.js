const upstashProviderName = "upstash";

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getProviderName() {
  return String(process.env.RATE_LIMIT_PROVIDER || "memory").trim().toLowerCase();
}

export function isUpstashRateLimitConfigured() {
  return (
    getProviderName() === upstashProviderName &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

async function upstashPipeline(commands) {
  const url = normalizeUrl(process.env.UPSTASH_REDIS_REST_URL);
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis request failed with ${response.status}.`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error("Upstash Redis returned an unexpected response.");
  }

  return payload;
}

export async function pingUpstashRateLimit() {
  if (!isUpstashRateLimitConfigured()) {
    return { ok: false, configured: false, provider: getProviderName() };
  }

  try {
    const result = await upstashPipeline([["PING"]]);
    return {
      ok: result[0]?.result === "PONG",
      configured: true,
      provider: upstashProviderName,
    };
  } catch {
    return {
      ok: false,
      configured: true,
      provider: upstashProviderName,
    };
  }
}

export async function checkUpstashFixedWindow({ key, limit, windowMs }) {
  if (!isUpstashRateLimitConfigured()) {
    return { ok: false, configured: false, provider: getProviderName() };
  }

  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const resetAtMs = (bucket + 1) * windowMs;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `ktrlai:rl:v1:${key}:${bucket}`;

  try {
    const result = await upstashPipeline([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSeconds + 5],
    ]);
    const count = Number(result[0]?.result || 0);
    const allowed = count <= limit;

    return {
      ok: true,
      allowed,
      provider: upstashProviderName,
      count,
      limit,
      remaining: Math.max(limit - count, 0),
      resetAt: new Date(resetAtMs).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      provider: upstashProviderName,
      errorMessage: error?.message || "Upstash Redis rate limit failed.",
    };
  }
}

export function getConfiguredRateLimitProvider() {
  return isUpstashRateLimitConfigured() ? upstashProviderName : "memory";
}
