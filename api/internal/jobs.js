import { getQueueStats, requireInternalJobSecret } from "../_jobs.js";
import { processQueuedJobs } from "../_jobRunner.js";
import { checkServerRateLimit, recordRateLimitTrigger, rateLimitExceededResponse } from "../_rateLimit.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "../_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../_supabaseAdmin.js";

function getLimit(req) {
  const rawLimit = req.query?.limit;
  const value = Array.isArray(rawLimit) ? rawLimit[0] : rawLimit;
  return Math.max(1, Math.min(Number(value) || 5, 10));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  if (!requireInternalJobSecret(req, res)) {
    return;
  }

  const rateLimit = await checkServerRateLimit(req, {
    scope: "internal_jobs",
    workspaceId: "platform",
    action: req.method.toLowerCase(),
    route: "/api/internal/jobs",
    max: req.method === "GET" ? 120 : 60,
    message: "Too many internal job runner requests. Please retry shortly.",
  });

  if (!rateLimit.ok) {
    if (isSupabaseAdminConfigured()) {
      await recordRateLimitTrigger(getSupabaseAdmin(), {
        workspaceId: null,
        scope: "internal_jobs",
        reason: "internal_jobs_limit",
        metadata: { provider: rateLimit.provider, reset_at: rateLimit.resetAt }
      });
    }

    return res.status(429).json(rateLimitExceededResponse(rateLimit));
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(501).json({
      ok: false,
      mode: "mock",
      message: "Job processing requires Supabase server credentials.",
    });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const queue = await getQueueStats(supabase);
    return res.status(200).json({
      ok: true,
      mode: "live",
      queue,
    });
  }

  const result = await processQueuedJobs(supabase, {
    limit: getLimit(req),
    maxRuntimeMs: 8000,
  });

  return res.status(result.ok ? 200 : 500).json({
    ok: result.ok,
    mode: "live",
    ...result,
  });
}
