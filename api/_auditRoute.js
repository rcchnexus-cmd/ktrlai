import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { requireWorkspaceRole } from "./_auth.js";
import { checkServerRateLimit, rateLimitExceededResponse } from "./_rateLimit.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

const allowedClientAuditEvents = new Set([auditEventTypes.login, auditEventTypes.logout]);

function getRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = getRequestBody(req);
  const workspaceId = body.workspace_id || body.workspaceId;
  const eventType = String(body.event_type || body.eventType || "").trim();

  if (!workspaceId || !allowedClientAuditEvents.has(eventType)) {
    return res.status(400).json({ ok: false, message: "workspace_id and a supported audit event are required." });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(202).json({ ok: true, mode: "mock", message: "Audit event accepted in local development mode." });
  }

  const rateLimit = await checkServerRateLimit(req, {
    scope: "audit",
    workspaceId,
    action: eventType,
    route: "/api/app",
    max: 60,
    message: "Too many audit events. Please retry shortly."
  });

  if (!rateLimit.ok) {
    return res.status(429).json(rateLimitExceededResponse(rateLimit));
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    allowedRoles: ["owner", "admin", "analyst", "viewer"],
    action: "record workspace audit events"
  });

  if (!auth.ok) {
    return;
  }

  await recordAuditEvent(supabase, {
    workspaceId,
    actorId: auth.user.id,
    eventType,
    metadata: {
      source: "client_session"
    }
  });

  return res.status(201).json({ ok: true, mode: "live" });
}
