import { randomUUID } from "node:crypto";
import {
  canManageOperations,
  canManageTeam,
  normalizeWorkspaceRole,
  requireWorkspaceRole
} from "./_auth.js";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { checkServerRateLimit } from "./_rateLimit.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

const readableRoles = ["owner", "admin", "analyst", "viewer"];
const inviteRoles = ["admin", "analyst", "viewer"];
const policyTypes = ["allow", "monitor", "restrict", "block"];
const policyScopes = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Unknown/Suspicious"];

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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function safeSelect(supabase, table, columns, buildQuery) {
  let query = supabase.from(table).select(columns);

  if (buildQuery) {
    query = buildQuery(query);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: [], warning: `${table}: ${error.message}` };
  }

  return { rows: data || [], warning: null };
}

function restrictedEnterpriseWorkspace(memberRole) {
  return {
    currentMemberRole: normalizeWorkspaceRole(memberRole),
    permissions: {
      canManageTeam: false,
      canManageOperations: false,
      canViewSecurity: false,
      canViewBilling: false
    },
    members: [],
    invitations: [],
    auditLogs: [],
    policies: [],
    warnings: []
  };
}

function defaultPolicies() {
  return [
    { id: "policy_gptbot", botScope: "GPTBot", policyType: "monitor", notes: "Watch OpenAI crawler activity before enforcing access." },
    { id: "policy_claudebot", botScope: "ClaudeBot", policyType: "monitor", notes: "Monitor Claude crawler behavior and content paths." },
    { id: "policy_perplexity", botScope: "PerplexityBot", policyType: "allow", notes: "Allow answer-engine preview access while analytics mature." },
    { id: "policy_google_extended", botScope: "Google-Extended", policyType: "restrict", notes: "Restrict training-style access unless explicitly licensed." },
    { id: "policy_unknown", botScope: "Unknown/Suspicious", policyType: "block", notes: "Treat unknown or suspicious scrapers conservatively." }
  ];
}

function mapPolicy(row) {
  return {
    id: row.id,
    botScope: row.bot_scope,
    policyType: row.policy_type,
    notes: row.notes || "",
    updatedAt: row.updated_at || row.created_at || null
  };
}

async function loadEnterpriseWorkspace(supabase, { workspaceId, memberRole }) {
  if (!canManageOperations(memberRole)) {
    return restrictedEnterpriseWorkspace(memberRole);
  }

  const warnings = [];
  const addWarning = (warning) => {
    if (warning) warnings.push(warning);
  };

  const [membersResult, invitationsResult, auditResult, policiesResult] = await Promise.all([
    safeSelect(supabase, "workspace_members", "id, workspace_id, user_id, role, created_at", (query) =>
      query.eq("workspace_id", workspaceId).order("created_at", { ascending: true }).limit(50)
    ),
    safeSelect(supabase, "workspace_invitations", "id, workspace_id, email, role, status, invited_by, created_at, expires_at", (query) =>
      query.eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50)
    ),
    safeSelect(supabase, "audit_logs", "id, workspace_id, actor_user_id, event_type, event_summary, metadata, timestamp", (query) =>
      query.eq("workspace_id", workspaceId).order("timestamp", { ascending: false }).limit(50)
    ),
    safeSelect(supabase, "ai_policies", "id, workspace_id, bot_scope, policy_type, notes, updated_at, created_at", (query) =>
      query.eq("workspace_id", workspaceId).order("bot_scope", { ascending: true }).limit(50)
    )
  ]);

  [membersResult, invitationsResult, auditResult, policiesResult].forEach((result) => addWarning(result.warning));

  const userIds = Array.from(
    new Set([
      ...membersResult.rows.map((member) => member.user_id),
      ...auditResult.rows.map((event) => event.actor_user_id),
      ...invitationsResult.rows.map((invite) => invite.invited_by)
    ].filter(Boolean))
  );

  const profilesResult = userIds.length
    ? await safeSelect(supabase, "profiles", "id, email, name", (query) => query.in("id", userIds))
    : { rows: [], warning: null };

  addWarning(profilesResult.warning);

  const profiles = new Map(profilesResult.rows.map((profile) => [profile.id, profile]));
  const policies = policiesResult.rows.length ? policiesResult.rows.map(mapPolicy) : defaultPolicies();

  return {
    currentMemberRole: normalizeWorkspaceRole(memberRole),
    permissions: {
      canManageTeam: canManageTeam(memberRole),
      canManageOperations: canManageOperations(memberRole),
      canViewSecurity: canManageOperations(memberRole),
      canViewBilling: canManageOperations(memberRole)
    },
    members: membersResult.rows.map((member) => {
      const profile = profiles.get(member.user_id) || {};
      return {
        id: member.id,
        userId: member.user_id,
        name: profile.name || "Team member",
        email: profile.email || "Unknown email",
        role: normalizeWorkspaceRole(member.role),
        createdAt: member.created_at
      };
    }),
    invitations: invitationsResult.rows.map((invite) => {
      const inviter = profiles.get(invite.invited_by) || {};
      return {
        id: invite.id,
        email: invite.email,
        role: normalizeWorkspaceRole(invite.role),
        status: invite.status || "pending",
        invitedBy: inviter.email || inviter.name || "Workspace owner",
        createdAt: invite.created_at,
        expiresAt: invite.expires_at
      };
    }),
    auditLogs: auditResult.rows.map((event) => {
      const actor = profiles.get(event.actor_user_id) || {};
      return {
        id: event.id,
        actor: actor.email || actor.name || "System",
        eventType: event.event_type,
        eventSummary: event.event_summary || String(event.event_type || "Audit event").replace(/_/g, " "),
        metadata: event.metadata || {},
        timestamp: event.timestamp
      };
    }),
    policies,
    warnings
  };
}

async function upsertDefaultPolicies(supabase, workspaceId) {
  const rows = defaultPolicies().map((policy) => ({
    workspace_id: workspaceId,
    bot_scope: policy.botScope,
    policy_type: policy.policyType,
    notes: policy.notes
  }));

  return supabase.from("ai_policies").upsert(rows, { onConflict: "workspace_id,bot_scope" });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = getRequestBody(req);
  const workspaceId = getWorkspaceId(req, body);

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: "workspace_id is required." });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(202).json({
      ok: true,
      mode: "mock",
      enterprise: {
        currentMemberRole: "owner",
        permissions: {
          canManageTeam: true,
          canManageOperations: true,
          canViewSecurity: true,
          canViewBilling: true
        },
        members: [],
        invitations: [],
        auditLogs: [],
        policies: defaultPolicies(),
        warnings: ["Local development enterprise data is using in-memory placeholders."]
      }
    });
  }

  const rateLimit = checkServerRateLimit(req, {
    scope: "team",
    workspaceId,
    max: req.method === "GET" ? 90 : 30
  });

  if (!rateLimit.ok) {
    return res.status(429).json({ ok: false, message: rateLimit.message });
  }

  const supabase = getSupabaseAdmin();
  const readAuth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    allowedRoles: readableRoles,
    action: "view workspace security settings"
  });

  if (!readAuth.ok) {
    return;
  }

  if (req.method === "GET") {
    const enterprise = await loadEnterpriseWorkspace(supabase, {
      workspaceId,
      memberRole: readAuth.member.role
    });

    return res.status(200).json({
      ok: true,
      mode: "live",
      enterprise
    });
  }

  const action = String(body.action || "").trim().toLowerCase();

  if (!action) {
    return res.status(400).json({ ok: false, message: "Team action is required." });
  }

  if (["invite", "remove_member", "update_role"].includes(action) && !canManageTeam(readAuth.member.role)) {
    return res.status(403).json({
      ok: false,
      mode: "live",
      message: "Only workspace owners can manage members and invitations."
    });
  }

  if (action === "save_policy" && !canManageOperations(readAuth.member.role)) {
    return res.status(403).json({
      ok: false,
      mode: "live",
      message: "Only workspace owners and admins can manage governance policies."
    });
  }

  if (action === "invite") {
    const email = normalizeEmail(body.email);
    const role = normalizeWorkspaceRole(body.role, "viewer");

    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, message: "Enter a valid invite email." });
    }

    if (!inviteRoles.includes(role)) {
      return res.status(400).json({ ok: false, message: "Invitations can be sent for admin, analyst, or viewer roles." });
    }

    const { data, error } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        status: "pending",
        token: randomUUID(),
        invited_by: readAuth.user.id
      })
      .select("id, workspace_id, email, role, status, invited_by, created_at, expires_at")
      .single();

    if (error) {
      return res.status(500).json({ ok: false, mode: "live", message: "Invitation could not be created." });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: readAuth.user.id,
      eventType: auditEventTypes.invitationCreated,
      metadata: { email, role, invitation_id: data.id }
    });

    return res.status(201).json({ ok: true, mode: "live", invitation: data });
  }

  if (action === "remove_member") {
    const userId = body.user_id || body.userId;

    if (!userId || userId === readAuth.user.id) {
      return res.status(400).json({ ok: false, message: "Choose another workspace member to remove." });
    }

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .neq("role", "owner");

    if (error) {
      return res.status(500).json({ ok: false, mode: "live", message: "Workspace member could not be removed." });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: readAuth.user.id,
      eventType: auditEventTypes.memberRemoved,
      metadata: { removed_user_id: userId }
    });

    return res.status(200).json({ ok: true, mode: "live", message: "Workspace member removed." });
  }

  if (action === "update_role") {
    const userId = body.user_id || body.userId;
    const role = normalizeWorkspaceRole(body.role, "");

    if (!userId || !inviteRoles.includes(role)) {
      return res.status(400).json({ ok: false, message: "A valid member and role are required." });
    }

    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .neq("role", "owner");

    if (error) {
      return res.status(500).json({ ok: false, mode: "live", message: "Workspace member role could not be updated." });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: readAuth.user.id,
      eventType: auditEventTypes.memberRoleChanged,
      metadata: { target_user_id: userId, role }
    });

    return res.status(200).json({ ok: true, mode: "live", message: "Workspace role updated." });
  }

  if (action === "save_policy") {
    const botScope = String(body.bot_scope || body.botScope || "").trim();
    const policyType = String(body.policy_type || body.policyType || "").trim().toLowerCase();
    const notes = String(body.notes || "").slice(0, 500);

    if (!policyScopes.includes(botScope) || !policyTypes.includes(policyType)) {
      return res.status(400).json({ ok: false, message: "A valid bot scope and policy type are required." });
    }

    await upsertDefaultPolicies(supabase, workspaceId);

    const { data, error } = await supabase
      .from("ai_policies")
      .upsert(
        {
          workspace_id: workspaceId,
          bot_scope: botScope,
          policy_type: policyType,
          notes,
          updated_by: readAuth.user.id,
          updated_at: new Date().toISOString()
        },
        { onConflict: "workspace_id,bot_scope" }
      )
      .select("id, workspace_id, bot_scope, policy_type, notes, updated_at, created_at")
      .single();

    if (error) {
      return res.status(500).json({ ok: false, mode: "live", message: "Governance policy could not be saved." });
    }

    await recordAuditEvent(supabase, {
      workspaceId,
      actorId: readAuth.user.id,
      eventType: auditEventTypes.governancePolicyChanged,
      metadata: { bot_scope: botScope, policy_type: policyType }
    });

    return res.status(200).json({ ok: true, mode: "live", policy: mapPolicy(data) });
  }

  return res.status(400).json({ ok: false, message: "Unsupported team action." });
}
