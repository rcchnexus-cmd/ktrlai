export const jobTypes = Object.freeze({
  sendEmail: "send_email",
  analyticsRollup: "analytics_rollup",
  suspiciousAlert: "suspicious_alert",
  auditEvent: "audit_event",
  cleanupTask: "cleanup_task",
});

export const jobStatuses = Object.freeze({
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
});

const allowedJobTypes = new Set(Object.values(jobTypes));
const allowedJobStatuses = new Set(Object.values(jobStatuses));

function sanitizeValue(value, depth = 0) {
  if (depth > 4) {
    return "[truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 60)
        .map(([key, entry]) => [
          key,
          /key|secret|token|hash|authorization|password/i.test(key) ? "[redacted]" : sanitizeValue(entry, depth + 1),
        ]),
    );
  }

  if (typeof value === "string") {
    return value.slice(0, 1200);
  }

  return value;
}

export function isValidJobType(type) {
  return allowedJobTypes.has(type);
}

export function isValidJobStatus(status) {
  return allowedJobStatuses.has(status);
}

export function sanitizeJobPayload(payload = {}) {
  return sanitizeValue(payload);
}

export function summarizeJobPayload(type, payload = {}) {
  const sanitized = sanitizeJobPayload(payload);

  if (type === jobTypes.sendEmail) {
    return {
      workspaceId: sanitized.workspaceId,
      type: sanitized.notificationType,
      recipientEmail: sanitized.recipientEmail,
      notificationEventId: sanitized.notificationEventId,
    };
  }

  if (type === jobTypes.auditEvent) {
    return {
      workspaceId: sanitized.workspaceId,
      eventType: sanitized.eventType,
    };
  }

  if (type === jobTypes.analyticsRollup) {
    return {
      workspaceId: sanitized.workspaceId || "recent workspaces",
      daysBack: sanitized.daysBack || 2,
      windowStart: sanitized.windowStart,
      windowEnd: sanitized.windowEnd,
    };
  }

  return sanitized;
}
