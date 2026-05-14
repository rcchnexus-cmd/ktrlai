import { requireWorkspaceRole } from "./_auth.js";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { enforceWorkspaceResourceLimit } from "./_planLimits.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { checkServerRateLimit, recordRateLimitTrigger, rateLimitExceededResponse } from "./_rateLimit.js";

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

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function toClientDomain(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    hostname: row.hostname,
    status: row.status,
    verificationToken: row.verification_token,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at
  };
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
  const hostname = normalizeHostname(body.hostname || body.domain);

  if (!workspaceId || !hostname) {
    return res.status(400).json({
      ok: false,
      message: "workspace_id and hostname are required."
    });
  }

  const rateLimit = await checkServerRateLimit(req, {
    scope: "domain",
    workspaceId,
    action: "create",
    route: "/api/app",
    max: 40,
    message: "Too many domain requests. Please retry shortly."
  });

  if (!rateLimit.ok) {
    if (isSupabaseAdminConfigured()) {
      await recordRateLimitTrigger(getSupabaseAdmin(), {
        workspaceId,
        scope: "domain",
        reason: "domain_mutation_limit",
        metadata: { provider: rateLimit.provider, hostname, reset_at: rateLimit.resetAt }
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
      message: "Domain creation requires Supabase in production."
    });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: "add domains"
  });

  if (!auth.ok) {
    return;
  }

  const { count, error: countError } = await supabase
    .from("domains")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .neq("status", "disabled");

  if (countError) {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "Domain limit could not be checked."
    });
  }

  const limitState = await enforceWorkspaceResourceLimit(supabase, {
    workspaceId,
    resource: "domains",
    currentCount: count || 0,
    nextCount: (count || 0) + 1,
    upgradeMessage: "Domain limit reached for this plan. Upgrade to connect more domains."
  });

  if (!limitState.ok) {
    return res.status(limitState.status || 402).json({
      ok: false,
      mode: "live",
      message: limitState.message,
      limit: {
        resource: "domains",
        plan: limitState.plan,
        max: limitState.limit,
        current: limitState.currentCount
      }
    });
  }

  const { data, error } = await supabase
    .from("domains")
    .insert({
      workspace_id: workspaceId,
      hostname,
      status: "pending"
    })
    .select("id, workspace_id, hostname, status, verification_token, verified_at, last_checked_at, created_at")
    .single();

  if (error) {
    const isDuplicate = String(error.code || "") === "23505";

    return res.status(isDuplicate ? 409 : 500).json({
      ok: false,
      mode: "live",
      message: isDuplicate ? "This domain is already connected to the workspace." : "Domain could not be added."
    });
  }

  await recordAuditEvent(supabase, {
    workspaceId,
    actorId: auth.user.id,
    eventType: auditEventTypes.domainAdded,
    metadata: {
      domain_id: data.id,
      hostname: data.hostname
    }
  });

  return res.status(201).json({
    ok: true,
    mode: "live",
    domain: toClientDomain(data),
    limit: {
      resource: "domains",
      plan: limitState.plan,
      max: limitState.limit,
      current: (count || 0) + 1
    }
  });
}
