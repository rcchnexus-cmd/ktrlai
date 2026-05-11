import { requirePlatformAdmin } from "../_adminAuth.js";
import { isApiKeyHashingConfigured } from "../_crypto.js";
import { sendMissingServerConfig } from "../_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../_supabaseAdmin.js";

const rowLimit = 50;

function maskProviderId(value) {
  const id = String(value || "");

  if (!id) {
    return "";
  }

  if (id.length <= 12) {
    return `${id.slice(0, 4)}...`;
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function toIso(value) {
  return value || null;
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildLookup(rows, key = "id") {
  return new Map((rows || []).map((row) => [row[key], row]));
}

function increment(map, key, amount = 1) {
  const safeKey = key || "Unknown";
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

async function safeSelect(supabase, table, columns, { order, ascending = false, limit = rowLimit, filters = [] } = {}) {
  let query = supabase.from(table).select(columns);

  for (const filter of filters) {
    query = filter(query);
  }

  if (order) {
    query = query.order(order, { ascending });
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: [], warning: `${table}: ${error.message}` };
  }

  return { rows: data || [], warning: null };
}

async function safeSelectWithFallback(supabase, table, columns, fallbackColumns, options = {}) {
  const result = await safeSelect(supabase, table, columns, options);

  if (!result.warning || !fallbackColumns) {
    return result;
  }

  const fallback = await safeSelect(supabase, table, fallbackColumns, options);

  if (fallback.warning) {
    return result;
  }

  return {
    rows: fallback.rows,
    warning: `${result.warning}; using reduced column set`
  };
}

async function safeCount(supabase, table, filters = []) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  for (const filter of filters) {
    query = filter(query);
  }

  const { count, error } = await query;

  if (error) {
    return { count: 0, warning: `${table}: ${error.message}` };
  }

  return { count: count || 0, warning: null };
}

async function countByWorkspace(supabase, table, workspaceIds, filters = []) {
  const entries = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const result = await safeCount(supabase, table, [
        (query) => query.eq("workspace_id", workspaceId),
        ...filters
      ]);

      return {
        workspaceId,
        count: result.count,
        warning: result.warning
      };
    })
  );

  return {
    counts: new Map(entries.map((entry) => [entry.workspaceId, entry.count])),
    warnings: entries.map((entry) => entry.warning).filter(Boolean)
  };
}

async function buildAdminSummary(supabase) {
  const warnings = [];
  const addWarning = (warning) => {
    if (warning) {
      warnings.push(warning);
    }
  };

  const [
    totalUsers,
    totalWorkspaces,
    totalDomains,
    verifiedDomains,
    activeApiKeys,
    eventsIngested,
    payoutRequestsCount,
    usersResult,
    workspacesResult,
    domainsResult,
    apiKeysResult,
    activityResult,
    payoutsResult,
    earningsResult,
    auditResult
  ] = await Promise.all([
    safeCount(supabase, "profiles"),
    safeCount(supabase, "workspaces"),
    safeCount(supabase, "domains"),
    safeCount(supabase, "domains", [(query) => query.eq("status", "verified")]),
    safeCount(supabase, "api_keys", [(query) => query.is("revoked_at", null)]),
    safeCount(supabase, "activity_logs"),
    safeCount(supabase, "payout_requests"),
    safeSelect(supabase, "profiles", "id, email, name, plan, created_at", {
      order: "created_at"
    }),
    safeSelectWithFallback(
      supabase,
      "workspaces",
      "id, name, owner_id, plan, subscription_status, stripe_customer_id, stripe_subscription_id, created_at",
      "id, name, owner_id, plan, created_at",
      { order: "created_at" }
    ),
    safeSelect(supabase, "domains", "id, workspace_id, hostname, status, last_checked_at, created_at", {
      order: "created_at"
    }),
    safeSelect(supabase, "api_keys", "id, workspace_id, key_prefix, last_used_at, revoked_at, created_at", {
      order: "created_at"
    }),
    safeSelectWithFallback(
      supabase,
      "activity_logs",
      "id, workspace_id, bot_type, page_path, url, page_title, status, occurred_at, metadata",
      "id, workspace_id, bot_type, page_path, status, occurred_at, metadata",
      { order: "occurred_at" }
    ),
    safeSelect(supabase, "payout_requests", "id, workspace_id, amount_cents, currency, status, created_at", {
      order: "created_at"
    }),
    safeSelect(supabase, "earnings_ledger", "id, workspace_id, source, amount_cents, currency, status, created_at", {
      order: "created_at",
      limit: 500
    }),
    safeSelect(supabase, "audit_events", "id, workspace_id, event_type, metadata, created_at", {
      order: "created_at",
      limit: rowLimit,
      filters: [(query) => query.in("event_type", ["plan_change", "payout_request"])]
    })
  ]);

  [
    totalUsers,
    totalWorkspaces,
    totalDomains,
    verifiedDomains,
    activeApiKeys,
    eventsIngested,
    payoutRequestsCount,
    usersResult,
    workspacesResult,
    domainsResult,
    apiKeysResult,
    activityResult,
    payoutsResult,
    earningsResult,
    auditResult
  ].forEach((result) => addWarning(result.warning));

  const users = usersResult.rows;
  const workspaces = workspacesResult.rows;
  const domains = domainsResult.rows;
  const apiKeys = apiKeysResult.rows;
  const activity = activityResult.rows;
  const payouts = payoutsResult.rows;
  const earnings = earningsResult.rows;
  const auditEvents = auditResult.rows;
  const usersById = buildLookup(users);
  const workspacesById = buildLookup(workspaces);
  const workspaceCountByUser = new Map();
  const domainsByWorkspace = new Map();
  const apiKeysByWorkspace = new Map();
  const eventsByWorkspace = new Map();
  const planCounts = new Map();
  const subscriptionStatuses = new Map();

  const workspaceIds = workspaces.map((workspace) => workspace.id).filter(Boolean);
  const memberships = workspaceIds.length
    ? await safeSelect(supabase, "workspace_members", "workspace_id, user_id, role", {
        limit: 500,
        filters: [(query) => query.in("workspace_id", workspaceIds)]
      })
    : { rows: [], warning: null };

  addWarning(memberships.warning);

  memberships.rows.forEach((member) => increment(workspaceCountByUser, member.user_id));
  domains.forEach((domain) => increment(domainsByWorkspace, domain.workspace_id));
  apiKeys.filter((key) => !key.revoked_at).forEach((key) => increment(apiKeysByWorkspace, key.workspace_id));
  activity.forEach((event) => increment(eventsByWorkspace, event.workspace_id));
  workspaces.forEach((workspace) => {
    increment(planCounts, workspace.plan || "Free");
    increment(subscriptionStatuses, workspace.subscription_status || "free");
  });

  if (workspaceIds.length) {
    const [domainCounts, apiKeyCounts, eventCounts] = await Promise.all([
      countByWorkspace(supabase, "domains", workspaceIds),
      countByWorkspace(supabase, "api_keys", workspaceIds, [(query) => query.is("revoked_at", null)]),
      countByWorkspace(supabase, "activity_logs", workspaceIds)
    ]);

    domainsByWorkspace.clear();
    apiKeysByWorkspace.clear();
    eventsByWorkspace.clear();
    domainCounts.counts.forEach((count, workspaceId) => domainsByWorkspace.set(workspaceId, count));
    apiKeyCounts.counts.forEach((count, workspaceId) => apiKeysByWorkspace.set(workspaceId, count));
    eventCounts.counts.forEach((count, workspaceId) => eventsByWorkspace.set(workspaceId, count));
    [...domainCounts.warnings, ...apiKeyCounts.warnings, ...eventCounts.warnings].forEach(addWarning);
  }

  const confirmedRevenueCents = earnings
    .filter((entry) => entry.status === "confirmed")
    .reduce((total, entry) => total + safeNumber(entry.amount_cents), 0);

  return {
    overview: {
      totalUsers: totalUsers.count,
      totalWorkspaces: totalWorkspaces.count,
      totalDomains: totalDomains.count,
      verifiedDomains: verifiedDomains.count,
      activeApiKeys: activeApiKeys.count,
      eventsIngested: eventsIngested.count,
      estimatedRevenueCents: confirmedRevenueCents,
      payoutRequests: payoutRequestsCount.count
    },
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || "Free",
      createdAt: toIso(user.created_at),
      workspaceCount: workspaceCountByUser.get(user.id) || 0
    })),
    workspaces: workspaces.map((workspace) => {
      const owner = usersById.get(workspace.owner_id);

      return {
        id: workspace.id,
        name: workspace.name,
        ownerName: owner?.name || "Unknown owner",
        ownerEmail: owner?.email || "",
        plan: workspace.plan || "Free",
        subscriptionStatus: workspace.subscription_status || "free",
        stripeCustomerId: maskProviderId(workspace.stripe_customer_id),
        stripeSubscriptionId: maskProviderId(workspace.stripe_subscription_id),
        domainsCount: domainsByWorkspace.get(workspace.id) || 0,
        apiKeysCount: apiKeysByWorkspace.get(workspace.id) || 0,
        eventsCount: eventsByWorkspace.get(workspace.id) || 0,
        createdAt: toIso(workspace.created_at)
      };
    }),
    activity: activity.map((event) => {
      const workspace = workspacesById.get(event.workspace_id);
      const metadata = event.metadata || {};

      return {
        id: event.id,
        workspaceName: workspace?.name || "Unknown workspace",
        botType: event.bot_type || metadata.detected_bot_type || "Unknown",
        page: event.page_title || event.url || event.page_path || metadata.page_url || "Untitled page",
        status: event.status || "allowed",
        timestamp: toIso(event.occurred_at)
      };
    }),
    domains: domains.map((domain) => {
      const workspace = workspacesById.get(domain.workspace_id);

      return {
        id: domain.id,
        hostname: domain.hostname,
        status: domain.status || "pending",
        workspaceName: workspace?.name || "Unknown workspace",
        lastCheckedAt: toIso(domain.last_checked_at),
        verificationTokenHidden: true
      };
    }),
    billing: {
      planCounts: Object.fromEntries(planCounts),
      subscriptionStatuses: Object.fromEntries(subscriptionStatuses),
      auditEvents: auditEvents.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        workspaceName: workspacesById.get(event.workspace_id)?.name || "Unknown workspace",
        createdAt: toIso(event.created_at)
      }))
    },
    payouts: payouts.map((request) => ({
      id: request.id,
      workspaceName: workspacesById.get(request.workspace_id)?.name || "Unknown workspace",
      amountCents: safeNumber(request.amount_cents),
      currency: request.currency || "USD",
      status: request.status || "requested",
      createdAt: toIso(request.created_at)
    })),
    systemHealth: {
      supabaseConnected: true,
      stripeConfigPresent: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_BUSINESS_PRICE_ID),
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      trackerEndpointStatus: isApiKeyHashingConfigured() ? "Ready" : "Missing API key hash secret",
      payoutsEnabled: process.env.PAYOUT_REQUESTS_ENABLED === "true",
      requiredEnv: {
        SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        API_KEY_HASH_SECRET: isApiKeyHashingConfigured(),
        STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
        STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        STRIPE_PRO_PRICE_ID: Boolean(process.env.STRIPE_PRO_PRICE_ID),
        STRIPE_BUSINESS_PRICE_ID: Boolean(process.env.STRIPE_BUSINESS_PRICE_ID)
      }
    },
    warnings
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  if (!isSupabaseAdminConfigured()) {
    return sendMissingServerConfig(res);
  }

  const supabase = getSupabaseAdmin();
  const auth = await requirePlatformAdmin(supabase, req, res);

  if (!auth.ok) {
    return;
  }

  if (req.query?.scope === "access") {
    return res.status(200).json({
      ok: true,
      mode: "live",
      isPlatformAdmin: true,
      admin: {
        role: auth.admin.role,
        userId: auth.user.id
      }
    });
  }

  const summary = await buildAdminSummary(supabase);

  return res.status(200).json({
    ok: true,
    mode: "live",
    generatedAt: new Date().toISOString(),
    admin: {
      role: auth.admin.role,
      userId: auth.user.id
    },
    ...summary
  });
}
