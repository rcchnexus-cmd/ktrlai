import { jobStatuses, isValidJobType, sanitizeJobPayload, summarizeJobPayload } from "./_jobTypes.js";

const defaultMaxAttempts = 3;

// Queue provider boundary:
// Today this uses Supabase as a lightweight durable queue. Keep callers using
// enqueueJob/processQueuedJobs so Redis, Upstash, or BullMQ can replace this
// persistence layer later without changing product flows.

function safeErrorMessage(error) {
  const message = error?.message || String(error || "Job queue error");
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 400);
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function isJobRunnerSecretConfigured() {
  return Boolean(process.env.INTERNAL_JOBS_SECRET);
}

export function requireInternalJobSecret(req, res) {
  const expectedSecret = process.env.INTERNAL_JOBS_SECRET || "";
  const authorization = req.headers.authorization || req.headers.Authorization || "";
  const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
  const headerSecret = req.headers["x-ktrlai-job-secret"];
  const providedSecret = String(headerSecret || "").trim() || (String(bearer).toLowerCase().startsWith("bearer ") ? String(bearer).slice(7).trim() : "");

  if (!expectedSecret) {
    res.status(500).json({
      ok: false,
      message: "Internal job runner secret is not configured.",
    });
    return false;
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({
      ok: false,
      message: "Internal job authorization is required.",
    });
    return false;
  }

  return true;
}

export async function enqueueJob(
  supabase,
  { type, payload = {}, availableAt = null, maxAttempts = defaultMaxAttempts, metadata = {} } = {},
) {
  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  if (!isValidJobType(type)) {
    return { ok: false, reason: "invalid_job_type" };
  }

  const safePayload = sanitizeJobPayload({
    ...payload,
    metadata: sanitizeJobPayload({ ...(payload.metadata || {}), ...(metadata || {}) }),
  });

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      type,
      status: jobStatuses.queued,
      payload: safePayload,
      max_attempts: Math.max(1, Math.min(Number(maxAttempts) || defaultMaxAttempts, 10)),
      available_at: normalizeDate(availableAt),
    })
    .select("id, type, status, attempts, max_attempts, available_at, created_at")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "enqueue_failed",
      errorMessage: safeErrorMessage(error),
    };
  }

  return { ok: true, job: data };
}

async function safeCount(supabase, filters = []) {
  let query = supabase.from("jobs").select("id", { count: "exact", head: true });

  for (const filter of filters) {
    query = filter(query);
  }

  const { count, error } = await query;

  if (error) {
    return { count: 0, warning: safeErrorMessage(error) };
  }

  return { count: count || 0, warning: null };
}

export async function getQueueStats(supabase) {
  if (!supabase) {
    return {
      configured: false,
      warning: "Supabase admin client unavailable.",
      counts: { queued: 0, processing: 0, completed: 0, failed: 0 },
      recentFailures: [],
    };
  }

  const [queued, processing, completed, failed, dueQueued, recentFailuresResult] = await Promise.all([
    safeCount(supabase, [(query) => query.eq("status", jobStatuses.queued)]),
    safeCount(supabase, [(query) => query.eq("status", jobStatuses.processing)]),
    safeCount(supabase, [(query) => query.eq("status", jobStatuses.completed)]),
    safeCount(supabase, [(query) => query.eq("status", jobStatuses.failed)]),
    safeCount(supabase, [
      (query) => query.eq("status", jobStatuses.queued),
      (query) => query.lte("available_at", new Date().toISOString()),
    ]),
    supabase
      .from("jobs")
      .select("id, type, attempts, max_attempts, error_message, failed_at, created_at")
      .eq("status", jobStatuses.failed)
      .order("failed_at", { ascending: false })
      .limit(8),
  ]);

  const warnings = [queued, processing, completed, failed, dueQueued]
    .map((result) => result.warning)
    .filter(Boolean);

  if (recentFailuresResult.error) {
    warnings.push(safeErrorMessage(recentFailuresResult.error));
  }

  return {
    configured: warnings.length === 0,
    warning: warnings[0] || null,
    counts: {
      queued: queued.count,
      processing: processing.count,
      completed: completed.count,
      failed: failed.count,
      dueQueued: dueQueued.count,
    },
    recentFailures: (recentFailuresResult.data || []).map((job) => ({
      id: job.id,
      type: job.type,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      errorMessage: job.error_message ? "Job failed with a recorded processing error." : "",
      failedAt: job.failed_at,
      createdAt: job.created_at,
    })),
  };
}

export async function getRecentJobs(supabase, { limit = 20 } = {}) {
  if (!supabase) {
    return { rows: [], warning: "Supabase admin client unavailable." };
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, type, status, payload, attempts, max_attempts, available_at, locked_at, completed_at, failed_at, error_message, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(Number(limit) || 20, 50)));

  if (error) {
    return { rows: [], warning: safeErrorMessage(error) };
  }

  return {
    rows: (data || []).map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      payloadSummary: summarizeJobPayload(job.type, job.payload || {}),
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      availableAt: job.available_at,
      lockedAt: job.locked_at,
      completedAt: job.completed_at,
      failedAt: job.failed_at,
      errorMessage: job.error_message ? "Job has a recorded error." : "",
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })),
    warning: null,
  };
}
