import { requireWorkspaceRole } from "../_auth.js";
import { sendMissingServerConfig } from "../_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../_supabaseAdmin.js";

const rangeDays = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

const botColors = ["#5B8CFF", "#9B6DFF", "#4ADE80", "#F97316", "#38BDF8", "#F472B6"];
const maxEventsForServerAggregation = 5000;

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

function buildAnalyticsPayload({ workspaceId, range, events, totalCount, window, latestEvent, eventsToday, domains }) {
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
    truncated: events.length >= maxEventsForServerAggregation
  };
}

async function fetchActivityRows(supabase, baseQuery) {
  const extendedColumns =
    "id, workspace_id, domain_id, bot_name, bot_type, category, confidence_score, is_ai_bot, is_search_engine, is_suspicious, detection_method, page_path, url, referrer, user_agent, page_title, status, tokens_used, region, occurred_at, metadata";
  const legacyColumns =
    "id, workspace_id, domain_id, bot_name, bot_type, page_path, url, referrer, user_agent, page_title, status, tokens_used, region, occurred_at, metadata";

  const extended = await baseQuery(
    supabase
      .from("activity_logs")
      .select(extendedColumns)
      .order("occurred_at", { ascending: false })
      .limit(maxEventsForServerAggregation)
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
      .limit(maxEventsForServerAggregation)
  );
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

  const workspaceId = getQueryParam(req, "workspace_id") || getQueryParam(req, "workspaceId");
  const range = normalizeRange(getQueryParam(req, "range"));

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

  const [
    { count, error: countError },
    { data, error },
    { data: latestEvent, error: latestError },
    { count: eventsToday, error: eventsTodayError },
    { data: domains, error: domainsError }
  ] = await Promise.all([
    baseQuery(supabase.from("activity_logs").select("id", { count: "exact", head: true })),
    fetchActivityRows(supabase, baseQuery),
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
      domains: domains || []
    })
  );
}
