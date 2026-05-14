import { requireWorkspaceRole } from "./_auth.js";
import { checkServerRateLimit, rateLimitExceededResponse } from "./_rateLimit.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { notificationEventTypes, sendWelcomeEmail } from "./_notifications.js";

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

function getWorkspaceId(req, body = {}) {
  return req.query?.workspace_id || req.query?.workspaceId || body.workspace_id || body.workspaceId;
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
  const workspaceId = getWorkspaceId(req, body);
  const type = String(body.type || "").trim().toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: "workspace_id is required." });
  }

  if (type !== notificationEventTypes.welcome) {
    return res.status(400).json({ ok: false, message: "Unsupported notification event." });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "Notification accepted for local development."
    });
  }

  const rateLimit = await checkServerRateLimit(req, {
    scope: "notification",
    workspaceId,
    action: type,
    route: "/api/app",
    max: 20
  });

  if (!rateLimit.ok) {
    return res.status(429).json(rateLimitExceededResponse(rateLimit));
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    allowedRoles: ["owner", "admin"],
    action: "send workspace notifications"
  });

  if (!auth.ok) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  await sendWelcomeEmail(supabase, {
    workspaceId,
    userId: auth.user.id,
    email: profile?.email || auth.user.email,
    name: profile?.name || auth.user.user_metadata?.name,
    workspaceName: workspace?.name
  });

  return res.status(202).json({
    ok: true,
    mode: "live",
    message: "Notification event accepted."
  });
}
