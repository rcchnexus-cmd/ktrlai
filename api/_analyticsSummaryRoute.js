import { requireWorkspaceRole } from "./_auth.js";
import { fetchAnalyticsRollups } from "./_analyticsRollups.js";
import { sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

const rangeDays = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

const botColors = ["#5B8CFF", "#9B6DFF", "#4ADE80", "#F97316", "#38BDF8", "#F472B6"];
const maxEventsByRange = {
  "7d": 2000,
  "30d": 3500,
  "90d": 5000
};
const maxEventsForServerAggregation = maxEventsByRange["90d"];

function getQueryParam(req, key) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRange(value) {
  return Object.prototype.hasOwnProperty.call(rangeDays, value) ? value : "7d";
}

function getRangeWindow(range) {
  const days = rangeDays[normalizeRange(range)];
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    days,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function buildDailyBuckets(start, days) {
  const buckets = new Map();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }).format(date),
      value: 0
    });
  }

  return buckets;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStatus(status) {
  return String(status || "allowed")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanBotName(value) {
  const bot = String(value || "UnknownBot").trim();

  if (bot === "UnknownBot") {
    return "Unknown Bot";
  }

  return bot;
}

function getBotCategory(botType) {
  const value = String(botType || "").toLowerCase();

  if (["chatgpt", "claude", "perplexity"].includes(value)) {
    return "Answer Engine";
  }

  if (value.includes("google")) {
    return "Search AI";
  }

  if (value.includes("unknown")) {
    return "Unknown";
  }

  if (value.includes("human")) {
    return "Browser";
  }

  return "AI Bot";
}

function getDetection(event) {
  const metadata = event.metadata || {};
  const detection = metadata.detection || {};
  const botType = event.bot_type || detection.bot_type || metadata.detected_bot_type || event.bot_name || "UnknownBot";
  const fallbackCategory = getBotCategory(botType).toLowerCase().replace(/\s+/g, "_");
  const category = event.category || detection.category || metadata.detection_category || fallbackCategory;
  const confidence = Number(event.confidence_score ?? detection.confidence_score ?? metadata.confidence_score ?? 0);

  const readBoolean = (value, fallback = false) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }

    return fallback;
  };

  return {
    botName: event.bot_name || detection.bot_name || metadata.detected_bot_name || botType,
    botType,
    category,
    confidenceScore: Number.isFinite(confidence) ? confidence : 0,
    isAiBot: readBoolean(event.is_ai_bot ?? detection.is_ai_bot ?? metadata.is_ai_bot, category.startsWith("ai_")),
    isSearchEngine: readBoolean(event.is_search_engine ?? detection.is_search_engine ?? metadata.is_search_engine, category === "search_engine"),
    isSuspicious: readBoolean(event.is_suspicious ?? detection.is_suspicious ?? metadata.is_suspicious, category === "scraper"),
    detectionMethod: event.detection_method || detection.detection_method || metadata.detection_method || "legacy"
  };
}

function getPageLabel(event) {
  return event.page_title || event.page_path || event.url || event.metadata?.page_url || "Untitled page";
}

function increment(map, key, amount = 1) {
  const safeKey = key || "Unknown";
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

function buildDistribution(botCounts, totalEvents) {
  return Array.from(botCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], index) => ({
      label: cleanBotName(label),
      value: totalEvents > 0 ? Math.max(Math.round((count / totalEvents) * 100), 1) : 0,
      count,
      color: botColors[index % botColors.length]
    }));
}

function buildTopPages(pageCounts) {
  return Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([page, visits]) => ({
      page,
      visits,
      revenueEstimateCents: visits * 12
    }));
}

function buildTopPagesFromRollups(pageCounts, pageRevenue) {
  return Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([page, visits]) => ({
      page,
      visits,
      revenueEstimateCents: Number(pageRevenue.get(page) || visits * 12)
    }));
}

function mergeCounts(target, counts = {}) {
  Object.entries(counts || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  });
}

function getInstallHealth({ totalEvents, latestEvent, eventsToday, domains }) {
  const latestEventAt = latestEvent?.occurred_at || null;
  const verifiedDomains = (domains || []).filter((domain) => String(domain.status || "").toLowerCase() === "verified").length;
  const now = Date.now();
  const latestTime = latestEventAt ? new Date(latestEventAt).getTime() : 0;
  const ageHours = latestTime ? (now - latestTime) / (1000 * 60 * 60) : null;
  let status = "not_installed";
  let trackerHealth = "No tracker events received";

  if (totalEvents > 0 || latestEventAt) {
    status = ageHours !== null && ageHours <= 24 ? "active" : "inactive";
    trackerHealth = status === "active" ? "Receiving events" : "No events in the last 24 hours";
  } else if (verifiedDomains > 0) {
    status = "pending";
    trackerHealth = "Waiting for first event";
  }

  return {
    status,
    sdkInstalled: Boolean(latestEventAt),
    lastEventAt: latestEventAt,
    eventsToday: Number(eventsToday || 0),
    activeDomains: verifiedDomains,
    trackerHealth
  };
}

function buildInstallHealthPayload({ workspaceId, latestEvent, eventsToday, domains }) {
  const hasLatestEvent = Boolean(latestEvent?.occurred_at);

  return {
    ok: true,
    mode: "live",
    workspaceId,
    hasRealData: hasLatestEvent,
    installHealth: getInstallHealth({
      totalEvents: hasLatestEvent ? 1 : 0,
      latestEvent,
      eventsToday,
      domains
    })
  };
}

function toRecentActivity(event) {
  const detection = getDetection(event);

  return {
    id: event.id,
    bot: cleanBotName(detection.botName),
    type: getBotCategory(detection.botType),
    botType: cleanBotName(detection.botType),
    category: detection.category,
    confidenceScore: detection.confidenceScore,
    isAiBot: detection.isAiBot,
    isSuspicious: detection.isSuspicious,
    page: getPageLabel(event),
    status: formatStatus(event.status),
    statusKey: event.status || "allowed",
    date: formatDate(event.occurred_at),
    time: formatTime(event.occurred_at),
    tokens: event.tokens_used ? Intl.NumberFormat("en").format(event.tokens_used) : "0",
    region: event.region || "Global",
    occurredAt: event.occurred_at,
    url: event.url || event.metadata?.page_url || "",
    referrer: event.referrer || ""
  };
}

function buildAnalyticsPayload({ workspaceId, range, events, totalCount, window, latestEvent, eventsToday, domains, aggregationLimit }) {
  const dailyBuckets = buildDailyBuckets(window.start, window.days);
  const botCounts = new Map();
  const pageCounts = new Map();
  const statusCounts = new Map();
  const categoryCounts = new Map();
  const aiBotCounts = new Map();
  const uniqueBots = new Set();
  const pages = new Set();
  let aiBotEvents = 0;
  let humanEvents = 0;
  let suspiciousEvents = 0;
  let highConfidenceTrainingEvents = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;

  for (const event of events) {
    const dayKey = formatDate(event.occurred_at);
    const dailyBucket = dailyBuckets.get(dayKey);
    const detection = getDetection(event);
    const botType = detection.botType;
    const page = getPageLabel(event);

    if (dailyBucket) {
      dailyBucket.value += 1;
    }

    uniqueBots.add(botType);
    pages.add(page);
    increment(botCounts, botType);
    increment(pageCounts, page);
    increment(statusCounts, event.status || "allowed");
    increment(categoryCounts, detection.category);

    if (detection.isAiBot) {
      aiBotEvents += 1;
      increment(aiBotCounts, detection.botName || botType);
    } else if (detection.category === "browser") {
      humanEvents += 1;
    }

    if (detection.isSuspicious) {
      suspiciousEvents += 1;
    }

    if (detection.category === "ai_training" && detection.confidenceScore >= 80) {
      highConfidenceTrainingEvents += 1;
    }

    if (detection.confidenceScore > 0) {
      confidenceTotal += detection.confidenceScore;
      confidenceCount += 1;
    }
  }

  const totalEvents = totalCount ?? events.length;
  const recentActivity = events.slice(0, 20).map(toRecentActivity);
  const topPages = buildTopPages(pageCounts);
  const estimatedCents = events.reduce((total, event) => {
    if (event.status === "paid_access") {
      return total + 18;
    }

    return total + 4;
  }, 0);

  return {
    ok: true,
    mode: "live",
    workspaceId,
    range,
    aggregationSource: "raw",
    rangeStart: window.startIso,
    rangeEnd: window.endIso,
    hasRealData: totalEvents > 0,
    totalEvents,
    uniqueBots: uniqueBots.size,
    pagesAccessed: pages.size,
    detectedBotTypes: Array.from(uniqueBots).map(cleanBotName).sort(),
    botDistribution: buildDistribution(botCounts, events.length),
    aiDetection: {
      aiBotEvents,
      humanEvents,
      suspiciousEvents,
      highConfidenceTrainingEvents,
      aiTrafficRatio: events.length > 0 ? Math.round((aiBotEvents / events.length) * 100) : 0,
      confidenceAverage: confidenceCount > 0 ? Math.round(confidenceTotal / confidenceCount) : 0,
      categoryCounts: Object.fromEntries(categoryCounts),
      topDetectedAiSystems: Array.from(aiBotCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name: cleanBotName(name), count }))
    },
    trafficOverTime: Array.from(dailyBuckets.values()),
    recentActivity,
    topPages,
    allowedBlockedCounts: Object.fromEntries(statusCounts),
    installHealth: getInstallHealth({
      totalEvents,
      latestEvent,
      eventsToday,
      domains
    }),
    revenueEstimate: {
      amountCents: estimatedCents,
      currency: "USD",
      formatted: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(estimatedCents / 100)
    },
    truncated: events.length >= (aggregationLimit || maxEventsForServerAggregation)
  };
}

function buildAnalyticsPayloadFromRollups({ workspaceId, range, rollups, recentEvents, window, latestEvent, eventsToday, domains }) {
  const dailyBuckets = buildDailyBuckets(window.start, window.days);
  const botCounts = new Map();
  const pageCounts = new Map();
  const pageRevenue = new Map();
  const statusCounts = new Map();
  const categoryCounts = {};
  const aiBotCounts = new Map();
  const uniqueBots = new Set();
  const pages = new Set();
  let totalEvents = 0;
  let pagesAccessed = 0;
  let aiBotEvents = 0;
  let humanEvents = 0;
  let suspiciousEvents = 0;
  let highConfidenceTrainingEvents = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;
  let estimatedCents = 0;

  for (const row of rollups.daily || []) {
    const bucketKey = String(row.date_bucket || "").slice(0, 10);
    const bucket = dailyBuckets.get(bucketKey);
    const count = Number(row.event_count || 0);

    if (bucket) {
      bucket.value = count;
    }

    totalEvents += count;
    pagesAccessed += Number(row.page_count || 0);
    aiBotEvents += Number(row.ai_bot_count || 0);
    humanEvents += Number(row.human_event_count || 0);
    suspiciousEvents += Number(row.suspicious_event_count || 0);
    highConfidenceTrainingEvents += Number(row.high_confidence_training_count || 0);
    confidenceTotal += Number(row.confidence_total || 0);
    confidenceCount += Number(row.confidence_count || 0);
    estimatedCents += Number(row.estimated_revenue_cents || 0);
    mergeCounts(categoryCounts, row.category_counts || {});
  }

  for (const row of rollups.bots || []) {
    const label = row.bot_type || row.bot_name || "UnknownBot";
    uniqueBots.add(label);
    increment(botCounts, label, Number(row.event_count || 0));

    if (row.is_ai_bot) {
      increment(aiBotCounts, row.bot_name || label, Number(row.event_count || 0));
    }
  }

  for (const row of rollups.pages || []) {
    const page = row.page_label || row.page_key || "Untitled page";
    pages.add(row.page_key || page);
    increment(pageCounts, page, Number(row.event_count || 0));
    increment(pageRevenue, page, Number(row.estimated_revenue_cents || 0));
  }

  for (const row of rollups.statuses || []) {
    increment(statusCounts, row.status || "allowed", Number(row.event_count || 0));
  }

  return {
    ok: true,
    mode: "live",
    workspaceId,
    range,
    rangeStart: window.startIso,
    rangeEnd: window.endIso,
    aggregationSource: "rollups",
    hasRealData: totalEvents > 0,
    totalEvents,
    uniqueBots: uniqueBots.size,
    pagesAccessed: pages.size || pagesAccessed,
    detectedBotTypes: Array.from(uniqueBots).map(cleanBotName).sort(),
    botDistribution: buildDistribution(botCounts, totalEvents),
    aiDetection: {
      aiBotEvents,
      humanEvents,
      suspiciousEvents,
      highConfidenceTrainingEvents,
      aiTrafficRatio: totalEvents > 0 ? Math.round((aiBotEvents / totalEvents) * 100) : 0,
      confidenceAverage: confidenceCount > 0 ? Math.round(confidenceTotal / confidenceCount) : 0,
      categoryCounts,
      topDetectedAiSystems: Array.from(aiBotCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name: cleanBotName(name), count }))
    },
    trafficOverTime: Array.from(dailyBuckets.values()),
    recentActivity: (recentEvents || []).slice(0, 20).map(toRecentActivity),
    topPages: buildTopPagesFromRollups(pageCounts, pageRevenue),
    allowedBlockedCounts: Object.fromEntries(statusCounts),
    installHealth: getInstallHealth({
      totalEvents,
      latestEvent,
      eventsToday,
      domains
    }),
    revenueEstimate: {
      amountCents: estimatedCents,
      currency: "USD",
      formatted: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(estimatedCents / 100)
    },
    truncated: false
  };
}

function rollupsCoverLatestEvent(rollups, latestEvent) {
  const latestDate = latestEvent?.occurred_at ? String(latestEvent.occurred_at).slice(0, 10) : "";

  if (!latestDate) {
    return true;
  }

  const latestRollupDate = (rollups.daily || [])
    .map((row) => String(row.date_bucket || "").slice(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1);

  return Boolean(latestRollupDate && latestRollupDate >= latestDate);
}

async function fetchActivityRows(supabase, baseQuery, maxRows = maxEventsForServerAggregation) {
  const extendedColumns =
    "id, workspace_id, domain_id, bot_name, bot_type, category, confidence_score, is_ai_bot, is_search_engine, is_suspicious, detection_method, page_path, url, referrer, user_agent, page_title, status, tokens_used, region, occurred_at, metadata";
  const legacyColumns =
    "id, workspace_id, domain_id, bot_name, bot_type, page_path, url, referrer, user_agent, page_title, status, tokens_used, region, occurred_at, metadata";

  const extended = await baseQuery(
    supabase
      .from("activity_logs")
      .select(extendedColumns)
      .order("occurred_at", { ascending: false })
      .limit(maxRows)
  );

  if (!extended.error) {
    return extended;
  }

  const message = String(extended.error.message || "");

  if (!/category|confidence_score|is_ai_bot|is_search_engine|is_suspicious|detection_method/i.test(message)) {
    return extended;
  }

  return baseQuery(
    supabase
      .from("activity_logs")
      .select(legacyColumns)
      .order("occurred_at", { ascending: false })
      .limit(maxRows)
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

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

  const workspaceId = getQueryParam(req, "workspace_id") || getQueryParam(req, "workspaceId");
  const range = normalizeRange(getQueryParam(req, "range"));
  const view = String(getQueryParam(req, "view") || "summary").toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: "workspace_id is required." });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    allowedRoles: [],
    action: "view analytics"
  });

  if (!auth.ok) {
    return;
  }

  const window = getRangeWindow(range);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const baseQuery = (query) =>
    query.eq("workspace_id", workspaceId).gte("occurred_at", window.startIso).lte("occurred_at", window.endIso);

  if (view === "install" || view === "install_health") {
    const [
      { data: latestEvent, error: latestError },
      { count: eventsToday, error: eventsTodayError },
      { data: domains, error: domainsError }
    ] = await Promise.all([
      supabase
        .from("activity_logs")
        .select("id, occurred_at")
        .eq("workspace_id", workspaceId)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("occurred_at", todayStart.toISOString()),
      supabase
        .from("domains")
        .select("id, status")
        .eq("workspace_id", workspaceId)
    ]);

    if (latestError || eventsTodayError || domainsError) {
      return res.status(500).json({
        ok: false,
        mode: "live",
        message: "Install health could not be loaded."
      });
    }

    return res.status(200).json(
      buildInstallHealthPayload({
        workspaceId,
        latestEvent,
        eventsToday: eventsToday || 0,
        domains: domains || []
      })
    );
  }

  const aggregationLimit = maxEventsByRange[range] || maxEventsForServerAggregation;
  const rollupWindow = {
    startDate: window.startIso.slice(0, 10),
    endDate: window.endIso.slice(0, 10)
  };
  const [
    rollups,
    recentResult,
    latestResult,
    eventsTodayResult,
    domainsResult
  ] = await Promise.all([
    fetchAnalyticsRollups(supabase, {
      workspaceId,
      startDate: rollupWindow.startDate,
      endDate: rollupWindow.endDate
    }),
    fetchActivityRows(supabase, baseQuery, 20),
    supabase
      .from("activity_logs")
      .select("id, occurred_at")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("occurred_at", todayStart.toISOString()),
    supabase
      .from("domains")
      .select("id, status")
      .eq("workspace_id", workspaceId)
  ]);

  if (!recentResult.error && !latestResult.error && !eventsTodayResult.error && !domainsResult.error && rollups.ok) {
    const rollupTotal = (rollups.daily || []).reduce((total, row) => total + Number(row.event_count || 0), 0);
    const hasFreshUnrolledRows = rollupTotal === 0 && (recentResult.data || []).length > 0;
    const hasLatestCoverage = rollupsCoverLatestEvent(rollups, latestResult.data);

    if (!hasFreshUnrolledRows && hasLatestCoverage) {
      return res.status(200).json(
        buildAnalyticsPayloadFromRollups({
          workspaceId,
          range,
          rollups,
          recentEvents: recentResult.data || [],
          window,
          latestEvent: latestResult.data,
          eventsToday: eventsTodayResult.count || 0,
          domains: domainsResult.data || []
        })
      );
    }
  }

  const [
    { count, error: countError },
    { data, error },
    { data: latestEvent, error: latestError },
    { count: eventsToday, error: eventsTodayError },
    { data: domains, error: domainsError }
  ] = await Promise.all([
    baseQuery(supabase.from("activity_logs").select("id", { count: "exact", head: true })),
    fetchActivityRows(supabase, baseQuery, aggregationLimit),
    supabase
      .from("activity_logs")
      .select("id, occurred_at")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("occurred_at", todayStart.toISOString()),
    supabase
      .from("domains")
      .select("id, status")
      .eq("workspace_id", workspaceId)
  ]);

  if (countError || error || latestError || eventsTodayError || domainsError) {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "Analytics could not be loaded."
    });
  }

  return res.status(200).json(
    buildAnalyticsPayload({
      workspaceId,
      range,
      events: data || [],
      totalCount: count || 0,
      window,
      latestEvent,
      eventsToday: eventsToday || 0,
      domains: domains || [],
      aggregationLimit
    })
  );
}
