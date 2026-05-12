import { requirePlatformAdmin } from "./_adminAuth.js";
import { isApiKeyHashingConfigured } from "./_crypto.js";
import { checkServerRateLimit } from "./_rateLimit.js";
import { sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

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

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function getPercentChange(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function readBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return fallback;
}

function getEventDetection(event = {}) {
  const metadata = event.metadata || {};
  const detection = metadata.detection || {};
  const botType = event.bot_type || detection.bot_type || metadata.detected_bot_type || event.bot_name || "UnknownBot";
  const category = event.category || detection.category || metadata.detection_category || "unknown";

  return {
    botName: event.bot_name || detection.bot_name || metadata.detected_bot_name || botType,
    botType,
    category,
    confidenceScore: Number(event.confidence_score ?? detection.confidence_score ?? metadata.confidence_score ?? 0),
    isAiBot: readBoolean(event.is_ai_bot ?? detection.is_ai_bot ?? metadata.is_ai_bot, String(category).startsWith("ai_")),
    isSuspicious: readBoolean(event.is_suspicious ?? detection.is_suspicious ?? metadata.is_suspicious, category === "scraper")
  };
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
  const sevenDaysAgo = isoDaysAgo(7);
  const fourteenDaysAgo = isoDaysAgo(14);

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
    auditResult,
    stripeEventsResult,
    eventsLast7Days,
    eventsPrevious7Days,
    activityLast7DaysResult,
    rateLimitEventsResult,
    enterpriseAuditResult,
    newUsersLast7Days,
    newWorkspacesLast7Days
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
      filters: [
        (query) =>
          query.in("event_type", [
            "plan_change",
            "payout_request",
            "stripe_webhook",
            "stripe_payment_failed",
            "stripe_subscription_canceled"
          ])
      ]
    }),
    safeSelect(supabase, "stripe_webhook_events", "id, event_id, event_type, workspace_id, status, processed_at, created_at, metadata", {
      order: "created_at",
      limit: rowLimit
    }),
    safeCount(supabase, "activity_logs", [(query) => query.gte("occurred_at", sevenDaysAgo)]),
    safeCount(supabase, "activity_logs", [
      (query) => query.gte("occurred_at", fourteenDaysAgo),
      (query) => query.lt("occurred_at", sevenDaysAgo)
    ]),
    safeSelect(supabase, "activity_logs", "id, workspace_id, bot_name, bot_type, occurred_at, metadata", {
      order: "occurred_at",
      limit: 5000,
      filters: [(query) => query.gte("occurred_at", sevenDaysAgo)]
    }),
    safeSelect(supabase, "rate_limit_events", "id, workspace_id, scope, reason, created_at, metadata", {
      order: "created_at",
      limit: rowLimit
    }),
    safeSelect(supabase, "audit_logs", "id, workspace_id, actor_user_id, event_type, event_summary, timestamp, metadata", {
      order: "timestamp",
      limit: rowLimit
    }),
    safeCount(supabase, "profiles", [(query) => query.gte("created_at", sevenDaysAgo)]),
    safeCount(supabase, "workspaces", [(query) => query.gte("created_at", sevenDaysAgo)])
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
    auditResult,
    stripeEventsResult,
    eventsLast7Days,
    eventsPrevious7Days,
    activityLast7DaysResult,
    rateLimitEventsResult,
    enterpriseAuditResult,
    newUsersLast7Days,
    newWorkspacesLast7Days
  ].forEach((result) => addWarning(result.warning));

  const users = usersResult.rows;
  const workspaces = workspacesResult.rows;
  const domains = domainsResult.rows;
  const apiKeys = apiKeysResult.rows;
  const activity = activityResult.rows;
  const payouts = payoutsResult.rows;
  const earnings = earningsResult.rows;
  const auditEvents = auditResult.rows;
  const stripeEvents = stripeEventsResult.rows;
  const activityLast7Days = activityLast7DaysResult.rows;
  const rateLimitEvents = rateLimitEventsResult.rows;
  const enterpriseAuditEvents = enterpriseAuditResult.rows;
  const usersById = buildLookup(users);
  const workspacesById = buildLookup(workspaces);
  const workspaceCountByUser = new Map();
  const domainsByWorkspace = new Map();
  const apiKeysByWorkspace = new Map();
  const eventsByWorkspace = new Map();
  const planCounts = new Map();
  const subscriptionStatuses = new Map();
  const botTypesLast7Days = new Map();
  const aiCrawlersLast7Days = new Map();
  const suspiciousByWorkspace = new Map();
  const eventVolumeByWorkspaceLast7Days = new Map();
  let aiBotEventsLast7Days = 0;
  let suspiciousEventsLast7Days = 0;
  let unknownCrawlerEventsLast7Days = 0;

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
  activityLast7Days.forEach((event) => {
    const detection = getEventDetection(event);

    increment(eventVolumeByWorkspaceLast7Days, event.workspace_id);
    increment(botTypesLast7Days, detection.botType || "UnknownBot");

    if (detection.isAiBot) {
      aiBotEventsLast7Days += 1;
      increment(aiCrawlersLast7Days, detection.botName || detection.botType);
    }

    if (detection.isSuspicious) {
      suspiciousEventsLast7Days += 1;
      increment(suspiciousByWorkspace, event.workspace_id);
    }

    if (detection.category === "unknown" || detection.botType === "UnknownBot") {
      unknownCrawlerEventsLast7Days += 1;
    }
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
      payoutRequests: payoutRequestsCount.count,
      eventsLast7Days: eventsLast7Days.count,
      activeWorkspacesWithEvents: new Set(activityLast7Days.map((event) => event.workspace_id).filter(Boolean)).size
    },
    platformAnalytics: {
      eventsLast7Days: eventsLast7Days.count,
      previous7DaysEvents: eventsPrevious7Days.count,
      eventGrowthPercent: getPercentChange(eventsLast7Days.count, eventsPrevious7Days.count),
      activeWorkspacesWithEvents: new Set(activityLast7Days.map((event) => event.workspace_id).filter(Boolean)).size,
      aiBotEvents: aiBotEventsLast7Days,
      suspiciousEvents: suspiciousEventsLast7Days,
      unknownCrawlerEvents: unknownCrawlerEventsLast7Days,
      topAiCrawlers: Array.from(aiCrawlersLast7Days.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([botName, count]) => ({ botName, count })),
      topBotTypes: Array.from(botTypesLast7Days.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([botType, count]) => ({ botType, count })),
      recentIngestionEvents: activity.slice(0, 12).map((event) => {
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
      })
    },
    security: {
      suspiciousWorkspaces: Array.from(suspiciousByWorkspace.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([workspaceId, suspiciousCount]) => ({
          workspaceId,
          workspaceName: workspacesById.get(workspaceId)?.name || "Unknown workspace",
          suspiciousCount
        })),
      ingestionSpikes: Array.from(eventVolumeByWorkspaceLast7Days.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([workspaceId, eventCount]) => ({
          workspaceId,
          workspaceName: workspacesById.get(workspaceId)?.name || "Unknown workspace",
          eventCount
        })),
      rateLimitTriggers: rateLimitEvents.map((event) => ({
        id: event.id,
        workspaceName: workspacesById.get(event.workspace_id)?.name || "Platform",
        scope: event.scope,
        reason: event.reason,
        createdAt: toIso(event.created_at)
      })),
      auditActivityFeed: enterpriseAuditEvents.map((event) => ({
        id: event.id,
        workspaceName: workspacesById.get(event.workspace_id)?.name || "Unknown workspace",
        actor: usersById.get(event.actor_user_id)?.email || "System",
        eventType: event.event_type,
        eventSummary: event.event_summary || String(event.event_type || "Audit event").replace(/_/g, " "),
        createdAt: toIso(event.timestamp)
      })),
      growth: {
        usersLast7Days: newUsersLast7Days.count,
        workspacesLast7Days: newWorkspacesLast7Days.count
      }
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
      recentBillingEvents: stripeEvents.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        status: event.status || "processed",
        workspaceName: workspacesById.get(event.workspace_id)?.name || "Unknown workspace",
        createdAt: toIso(event.created_at)
      })),
      failedPayments: stripeEvents
        .filter((event) => event.event_type === "invoice.payment_failed")
        .map((event) => ({
          id: event.id,
          workspaceName: workspacesById.get(event.workspace_id)?.name || "Unknown workspace",
          status: event.status || "processed",
          createdAt: toIso(event.created_at)
        })),
      cancellations: stripeEvents
        .filter((event) => event.event_type === "customer.subscription.deleted")
        .map((event) => ({
          id: event.id,
          workspaceName: workspacesById.get(event.workspace_id)?.name || "Unknown workspace",
          status: event.status || "processed",
          createdAt: toIso(event.created_at)
        })),
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
      healthEndpointStatus: "Available at /api/health",
      rateLimitStore: "In-memory per serverless instance",
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

  const rateLimit = checkServerRateLimit(req, {
    scope: "admin_summary",
    workspaceId: "platform",
    max: 90,
    message: "Too many admin requests. Please retry shortly."
  });

  if (!rateLimit.ok) {
    return res.status(429).json({ ok: false, message: rateLimit.message });
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
