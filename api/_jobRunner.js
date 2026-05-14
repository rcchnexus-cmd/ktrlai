import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { jobStatuses, jobTypes } from "./_jobTypes.js";
import { processQueuedEmailNotification } from "./_notifications.js";

const defaultBatchLimit = 5;
const maxBatchLimit = 10;
const defaultRuntimeMs = 8000;

function safeErrorMessage(error) {
  const message = error?.message || String(error || "Job processing error");
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 500);
}

function retryAvailableAt(attempts) {
  const seconds = Math.min(15 * 60, Math.max(30, 30 * Math.pow(2, Math.max(0, attempts - 1))));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function claimJob(supabase, job) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: jobStatuses.processing,
      locked_at: new Date().toISOString(),
      attempts: Number(job.attempts || 0) + 1,
      error_message: null,
    })
    .eq("id", job.id)
    .eq("status", jobStatuses.queued)
    .select("id, type, status, payload, attempts, max_attempts, available_at, created_at")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error };
  }

  return { ok: true, job: data };
}

async function completeJob(supabase, jobId) {
  await supabase
    .from("jobs")
    .update({
      status: jobStatuses.completed,
      completed_at: new Date().toISOString(),
      locked_at: null,
      error_message: null,
    })
    .eq("id", jobId);
}

async function failOrRetryJob(supabase, job, errorMessage) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 3);
  const exhausted = attempts >= maxAttempts;

  await supabase
    .from("jobs")
    .update({
      status: exhausted ? jobStatuses.failed : jobStatuses.queued,
      available_at: exhausted ? job.available_at : retryAvailableAt(attempts),
      locked_at: null,
      failed_at: exhausted ? new Date().toISOString() : null,
      error_message: errorMessage,
    })
    .eq("id", job.id);

  return exhausted ? "failed" : "retrying";
}

export async function processJob(supabase, job) {
  const payload = job.payload || {};

  if (job.type === jobTypes.sendEmail) {
    return processQueuedEmailNotification(supabase, payload);
  }

  if (job.type === jobTypes.suspiciousAlert) {
    if (payload.notification) {
      return processQueuedEmailNotification(supabase, payload.notification);
    }

    return { ok: true, message: "Suspicious alert placeholder processed." };
  }

  if (job.type === jobTypes.auditEvent) {
    const result = await recordAuditEvent(supabase, {
      workspaceId: payload.workspaceId,
      actorId: payload.actorId || null,
      eventType: payload.eventType || auditEventTypes.securitySettingChanged,
      eventSummary: payload.eventSummary || "",
      metadata: payload.metadata || {},
    });

    return result.ok ? { ok: true } : { ok: false, errorMessage: "Audit event could not be recorded." };
  }

  if (job.type === jobTypes.analyticsRollup) {
    return {
      ok: true,
      message: "Analytics rollup placeholder processed. Future materialized rollups can be triggered here.",
    };
  }

  if (job.type === jobTypes.cleanupTask) {
    return {
      ok: true,
      message: "Cleanup task placeholder processed.",
    };
  }

  return { ok: false, errorMessage: "Unsupported job type." };
}

export async function processQueuedJobs(supabase, { limit = defaultBatchLimit, maxRuntimeMs = defaultRuntimeMs } = {}) {
  const startedAt = Date.now();
  const batchLimit = Math.max(1, Math.min(Number(limit) || defaultBatchLimit, maxBatchLimit));
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, type, status, payload, attempts, max_attempts, available_at, created_at")
    .eq("status", jobStatuses.queued)
    .lte("available_at", now)
    .order("available_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchLimit);

  if (error) {
    return {
      ok: false,
      processed: 0,
      failed: 0,
      retried: 0,
      message: safeErrorMessage(error),
      jobs: [],
    };
  }

  const results = [];

  for (const pendingJob of data || []) {
    if (Date.now() - startedAt > maxRuntimeMs) {
      results.push({
        id: pendingJob.id,
        type: pendingJob.type,
        status: "skipped",
        message: "Job runner runtime budget reached.",
      });
      break;
    }

    const claim = await claimJob(supabase, pendingJob);

    if (!claim.ok) {
      results.push({
        id: pendingJob.id,
        type: pendingJob.type,
        status: "skipped",
        message: "Job was already claimed or could not be locked.",
      });
      continue;
    }

    try {
      const result = await processJob(supabase, claim.job);

      if (result.ok) {
        await completeJob(supabase, claim.job.id);
        results.push({ id: claim.job.id, type: claim.job.type, status: "completed" });
      } else {
        const status = await failOrRetryJob(supabase, claim.job, result.errorMessage || result.message || "Job failed.");
        results.push({ id: claim.job.id, type: claim.job.type, status });
      }
    } catch (error) {
      const status = await failOrRetryJob(supabase, claim.job, safeErrorMessage(error));
      results.push({ id: claim.job.id, type: claim.job.type, status });
    }
  }

  return {
    ok: true,
    processed: results.filter((job) => job.status === "completed").length,
    failed: results.filter((job) => job.status === "failed").length,
    retried: results.filter((job) => job.status === "retrying").length,
    skipped: results.filter((job) => job.status === "skipped").length,
    jobs: results,
  };
}
