import { jobStatuses, jobTypes } from "./_jobTypes.js";

const maxWorkspaceBatch = 25;
const maxRowsPerDay = 10000;
const maxRollupDays = 7;
const defaultRollupDays = 2;

function safeErrorMessage(error) {
  return String(error?.message || error || "Analytics rollup error")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function dayWindowFromKey(key) {
  const start = new Date(`${key}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    key,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function getRollupDayWindows({ daysBack = defaultRollupDays, windowStart, windowEnd } = {}) {
  if (windowStart || windowEnd) {
    const start = windowStart ? new Date(windowStart) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = windowEnd ? new Date(windowEnd) : new Date();
    const keys = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (cursor <= last && keys.length < maxRollupDays) {
      keys.push(dateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return keys.map(dayWindowFromKey);
  }

  const count = Math.max(1, Math.min(Number(daysBack) || defaultRollupDays, maxRollupDays));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (count - index - 1));
    return dayWindowFromKey(dateKey(date));
  });
}

function increment(map, key, amount = 1) {
  const safeKey = String(key || "unknown");
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

function incrementObject(object, key, amount = 1) {
  const safeKey = String(key || "unknown");
  object[safeKey] = safeNumber(object[safeKey]) + amount;
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

function getDetection(event = {}) {
  const metadata = event.metadata || {};
  const detection = metadata.detection || {};
  const botType = event.bot_type || detection.bot_type || metadata.detected_bot_type || event.bot_name || "UnknownBot";
  const category = event.category || detection.category || metadata.detection_category || "unknown";
  const confidence = Number(event.confidence_score ?? detection.confidence_score ?? metadata.confidence_score ?? 0);

  return {
    botName: event.bot_name || detection.bot_name || metadata.detected_bot_name || botType,
    botType,
    category,
    confidenceScore: Number.isFinite(confidence) ? confidence : 0,
    isAiBot: readBoolean(event.is_ai_bot ?? detection.is_ai_bot ?? metadata.is_ai_bot, String(category).startsWith("ai_")),
    isSuspicious: readBoolean(event.is_suspicious ?? detection.is_suspicious ?? metadata.is_suspicious, category === "scraper")
  };
}

function getPageLabel(event = {}) {
  return event.page_title || event.page_path || event.url || event.metadata?.page_url || "Untitled page";
}

function getPageKey(event = {}) {
  return String(event.page_path || event.url || event.metadata?.page_url || getPageLabel(event) || "untitled")
    .trim()
    .slice(0, 500);
}

function estimateEventRevenueCents(event = {}) {
  return event.status === "paid_access" ? 18 : 4;
}

function aggregateEvents(workspaceId, day, rows) {
  const uniqueBots = new Set();
  const uniquePages = new Set();
  const statusCounts = {};
  const categoryCounts = {};
  const botMap = new Map();
  const pageMap = new Map();
  const statusMap = new Map();
  const daily = {
    workspace_id: workspaceId,
    date_bucket: day.key,
    event_count: rows.length,
    unique_bot_count: 0,
    page_count: 0,
    ai_bot_count: 0,
    human_event_count: 0,
    suspicious_event_count: 0,
    high_confidence_training_count: 0,
    confidence_total: 0,
    confidence_count: 0,
    allowed_count: 0,
    blocked_count: 0,
    restricted_count: 0,
    paid_access_count: 0,
    status_counts: statusCounts,
    category_counts: categoryCounts,
    estimated_revenue_cents: 0,
    first_event_at: null,
    last_event_at: null,
    updated_at: new Date().toISOString()
  };

  rows.forEach((event) => {
    const detection = getDetection(event);
    const status = event.status || "allowed";
    const pageKey = getPageKey(event);
    const pageLabel = getPageLabel(event);
    const occurredAt = event.occurred_at || new Date().toISOString();
    const estimatedRevenueCents = estimateEventRevenueCents(event);

    uniqueBots.add(detection.botType);
    uniquePages.add(pageKey);
    incrementObject(statusCounts, status);
    incrementObject(categoryCounts, detection.category);
    daily.estimated_revenue_cents += estimatedRevenueCents;

    if (!daily.first_event_at || new Date(occurredAt) < new Date(daily.first_event_at)) {
      daily.first_event_at = occurredAt;
    }

    if (!daily.last_event_at || new Date(occurredAt) > new Date(daily.last_event_at)) {
      daily.last_event_at = occurredAt;
    }

    if (status === "allowed") {
      daily.allowed_count += 1;
    } else if (status === "blocked") {
      daily.blocked_count += 1;
    } else if (status === "restricted" || status === "summaries_only") {
      daily.restricted_count += 1;
    } else if (status === "paid_access") {
      daily.paid_access_count += 1;
    }

    if (detection.isAiBot) {
      daily.ai_bot_count += 1;
    } else if (detection.category === "browser") {
      daily.human_event_count += 1;
    }

    if (detection.isSuspicious) {
      daily.suspicious_event_count += 1;
    }

    if (detection.category === "ai_training" && detection.confidenceScore >= 80) {
      daily.high_confidence_training_count += 1;
    }

    if (detection.confidenceScore > 0) {
      daily.confidence_total += detection.confidenceScore;
      daily.confidence_count += 1;
    }

    const botKey = detection.botType || "UnknownBot";
    const bot = botMap.get(botKey) || {
      workspace_id: workspaceId,
      date_bucket: day.key,
      bot_type: botKey,
      bot_name: detection.botName || botKey,
      category: detection.category,
      is_ai_bot: detection.isAiBot,
      is_suspicious: detection.isSuspicious,
      event_count: 0,
      confidence_total: 0,
      confidence_count: 0,
      last_seen_at: null,
      updated_at: new Date().toISOString()
    };
    bot.event_count += 1;
    bot.is_ai_bot = bot.is_ai_bot || detection.isAiBot;
    bot.is_suspicious = bot.is_suspicious || detection.isSuspicious;
    bot.last_seen_at = !bot.last_seen_at || new Date(occurredAt) > new Date(bot.last_seen_at) ? occurredAt : bot.last_seen_at;
    if (detection.confidenceScore > 0) {
      bot.confidence_total += detection.confidenceScore;
      bot.confidence_count += 1;
    }
    botMap.set(botKey, bot);

    const page = pageMap.get(pageKey) || {
      workspace_id: workspaceId,
      date_bucket: day.key,
      page_key: pageKey,
      page_label: pageLabel,
      event_count: 0,
      paid_access_count: 0,
      estimated_revenue_cents: 0,
      last_seen_at: null,
      updated_at: new Date().toISOString()
    };
    page.event_count += 1;
    page.paid_access_count += status === "paid_access" ? 1 : 0;
    page.estimated_revenue_cents += estimatedRevenueCents;
    page.last_seen_at = !page.last_seen_at || new Date(occurredAt) > new Date(page.last_seen_at) ? occurredAt : page.last_seen_at;
    pageMap.set(pageKey, page);

    increment(statusMap, status);
  });

  daily.unique_bot_count = uniqueBots.size;
  daily.page_count = uniquePages.size;

  return {
    daily,
    bots: Array.from(botMap.values()),
    pages: Array.from(pageMap.values()),
    statuses: Array.from(statusMap.entries()).map(([status, eventCount]) => ({
      workspace_id: workspaceId,
      date_bucket: day.key,
      status,
      event_count: eventCount,
      updated_at: new Date().toISOString()
    }))
  };
}

async function fetchActivityForDay(supabase, workspaceId, day) {
  const extendedColumns =
    "id, workspace_id, bot_name, bot_type, category, confidence_score, is_ai_bot, is_suspicious, page_path, url, page_title, status, occurred_at, metadata";
  const legacyColumns =
    "id, workspace_id, bot_name, bot_type, page_path, url, page_title, status, occurred_at, metadata";
  const buildQuery = (columns) =>
    supabase
      .from("activity_logs")
      .select(columns)
      .eq("workspace_id", workspaceId)
      .gte("occurred_at", day.startIso)
      .lt("occurred_at", day.endIso)
      .order("occurred_at", { ascending: true })
      .limit(maxRowsPerDay);

  const extended = await buildQuery(extendedColumns);

  if (!extended.error) {
    return extended;
  }

  if (!/category|confidence_score|is_ai_bot|is_suspicious/i.test(String(extended.error.message || ""))) {
    return extended;
  }

  return buildQuery(legacyColumns);
}

async function clearRollupsForDay(supabase, workspaceId, dayKey) {
  const tables = ["analytics_bot_rollups", "analytics_page_rollups", "analytics_status_rollups"];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("workspace_id", workspaceId).eq("date_bucket", dayKey);

    if (error) {
      return { ok: false, error };
    }
  }

  return { ok: true };
}

async function persistRollupDay(supabase, aggregate) {
  const clear = await clearRollupsForDay(supabase, aggregate.daily.workspace_id, aggregate.daily.date_bucket);

  if (!clear.ok) {
    return clear;
  }

  if (!aggregate.daily.event_count) {
    const { error } = await supabase
      .from("analytics_daily_rollups")
      .delete()
      .eq("workspace_id", aggregate.daily.workspace_id)
      .eq("date_bucket", aggregate.daily.date_bucket);
    return { ok: !error, error };
  }

  const { error: dailyError } = await supabase
    .from("analytics_daily_rollups")
    .upsert(aggregate.daily, { onConflict: "workspace_id,date_bucket" });

  if (dailyError) {
    return { ok: false, error: dailyError };
  }

  for (const [table, rows] of [
    ["analytics_bot_rollups", aggregate.bots],
    ["analytics_page_rollups", aggregate.pages],
    ["analytics_status_rollups", aggregate.statuses]
  ]) {
    if (!rows.length) {
      continue;
    }

    const { error } = await supabase.from(table).insert(rows);

    if (error) {
      return { ok: false, error };
    }
  }

  return { ok: true };
}

async function discoverWorkspaceIds(supabase, dayWindows) {
  const firstWindow = dayWindows[0];
  const lastWindow = dayWindows[dayWindows.length - 1];
  const { data, error } = await supabase
    .from("activity_logs")
    .select("workspace_id")
    .gte("occurred_at", firstWindow.startIso)
    .lt("occurred_at", lastWindow.endIso)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (error) {
    return { workspaceIds: [], error };
  }

  return {
    workspaceIds: Array.from(new Set((data || []).map((row) => row.workspace_id).filter(Boolean))).slice(0, maxWorkspaceBatch),
    error: null
  };
}

async function insertRollupRun(supabase, row) {
  const { error } = await supabase.from("analytics_rollup_runs").insert({
    ...row,
    metadata: row.metadata || {},
    completed_at: new Date().toISOString()
  });

  return { ok: !error, error };
}

export async function processAnalyticsRollupJob(supabase, payload = {}) {
  const dayWindows = getRollupDayWindows(payload);
  const discovery = payload.workspaceId
    ? { workspaceIds: [payload.workspaceId], error: null }
    : await discoverWorkspaceIds(supabase, dayWindows);
  const workspaceIds = discovery.workspaceIds;
  const windowStart = dayWindows[0]?.startIso || new Date().toISOString();
  const windowEnd = dayWindows[dayWindows.length - 1]?.endIso || new Date().toISOString();
  let processedEvents = 0;
  let processedDays = 0;
  const warnings = [];

  if (discovery.error) {
    return {
      ok: false,
      errorMessage: safeErrorMessage(discovery.error)
    };
  }

  if (!workspaceIds.length) {
    await insertRollupRun(supabase, {
      workspace_id: null,
      status: "completed",
      window_start: windowStart,
      window_end: windowEnd,
      processed_events: 0,
      processed_days: 0,
      metadata: { reason: "no_recent_workspaces" }
    });
    return { ok: true, message: "No recent activity found for analytics rollup." };
  }

  try {
    for (const workspaceId of workspaceIds) {
      for (const day of dayWindows) {
        const { data, error } = await fetchActivityForDay(supabase, workspaceId, day);

        if (error) {
          throw error;
        }

        const rows = data || [];
        const aggregate = aggregateEvents(workspaceId, day, rows);
        const persisted = await persistRollupDay(supabase, aggregate);

        if (!persisted.ok) {
          throw persisted.error;
        }

        processedEvents += rows.length;
        processedDays += 1;

        if (rows.length >= maxRowsPerDay) {
          warnings.push(`${workspaceId}:${day.key}:row_limit_reached`);
        }
      }
    }

    await insertRollupRun(supabase, {
      workspace_id: payload.workspaceId || null,
      status: warnings.length ? "partial" : "completed",
      window_start: windowStart,
      window_end: windowEnd,
      processed_events: processedEvents,
      processed_days: processedDays,
      metadata: { workspace_count: workspaceIds.length, warnings }
    });

    return {
      ok: true,
      processedEvents,
      processedDays,
      workspaceCount: workspaceIds.length,
      warnings
    };
  } catch (error) {
    await insertRollupRun(supabase, {
      workspace_id: payload.workspaceId || null,
      status: "failed",
      window_start: windowStart,
      window_end: windowEnd,
      processed_events: processedEvents,
      processed_days: processedDays,
      error_message: safeErrorMessage(error),
      metadata: { workspace_count: workspaceIds.length }
    });

    return {
      ok: false,
      errorMessage: safeErrorMessage(error)
    };
  }
}

async function selectRollupRows(supabase, table, columns, { workspaceId, startDate, endDate, order = "date_bucket" }) {
  return supabase
    .from(table)
    .select(columns)
    .eq("workspace_id", workspaceId)
    .gte("date_bucket", startDate)
    .lte("date_bucket", endDate)
    .order(order, { ascending: true });
}

export async function fetchAnalyticsRollups(supabase, { workspaceId, startDate, endDate } = {}) {
  const [daily, bots, pages, statuses] = await Promise.all([
    selectRollupRows(supabase, "analytics_daily_rollups", "*", { workspaceId, startDate, endDate }),
    selectRollupRows(supabase, "analytics_bot_rollups", "*", { workspaceId, startDate, endDate }),
    selectRollupRows(supabase, "analytics_page_rollups", "*", { workspaceId, startDate, endDate }),
    selectRollupRows(supabase, "analytics_status_rollups", "*", { workspaceId, startDate, endDate })
  ]);

  const error = daily.error || bots.error || pages.error || statuses.error;

  if (error) {
    return {
      ok: false,
      unavailable: /analytics_.*rollups|schema cache|relation/i.test(String(error.message || "")),
      message: safeErrorMessage(error)
    };
  }

  return {
    ok: true,
    daily: daily.data || [],
    bots: bots.data || [],
    pages: pages.data || [],
    statuses: statuses.data || []
  };
}

async function safeCount(supabase, table, filters = []) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  for (const filter of filters) {
    query = filter(query);
  }

  const { count, error } = await query;

  return { count: count || 0, error };
}

export async function getRollupHealth(supabase) {
  if (!supabase) {
    return { configured: false, warning: "Supabase admin client unavailable." };
  }

  const [dailyCount, latestRun, latestCompleted, latestFailed, pendingJobs, coverageStart, coverageEnd] = await Promise.all([
    safeCount(supabase, "analytics_daily_rollups"),
    supabase
      .from("analytics_rollup_runs")
      .select("id, status, processed_events, processed_days, error_message, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("analytics_rollup_runs")
      .select("id, processed_events, processed_days, completed_at")
      .in("status", ["completed", "partial"])
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    safeCount(supabase, "analytics_rollup_runs", [(query) => query.eq("status", "failed")]),
    safeCount(supabase, "jobs", [
      (query) => query.eq("type", jobTypes.analyticsRollup),
      (query) => query.eq("status", jobStatuses.queued)
    ]),
    supabase
      .from("analytics_daily_rollups")
      .select("date_bucket")
      .order("date_bucket", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("analytics_daily_rollups")
      .select("date_bucket")
      .order("date_bucket", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const error =
    dailyCount.error ||
    latestRun.error ||
    latestCompleted.error ||
    latestFailed.error ||
    pendingJobs.error ||
    coverageStart.error ||
    coverageEnd.error;

  if (error) {
    return {
      configured: false,
      warning: safeErrorMessage(error),
      lastSuccessfulRunAt: null,
      pendingJobs: 0,
      failedRuns: 0
    };
  }

  return {
    configured: true,
    rollupRows: dailyCount.count,
    lastRunStatus: latestRun.data?.status || "never",
    lastRunAt: latestRun.data?.completed_at || latestRun.data?.created_at || null,
    lastSuccessfulRunAt: latestCompleted.data?.completed_at || null,
    lastProcessedEvents: safeNumber(latestCompleted.data?.processed_events),
    lastProcessedDays: safeNumber(latestCompleted.data?.processed_days),
    pendingJobs: pendingJobs.count,
    failedRuns: latestFailed.count,
    coverageStart: coverageStart.data?.date_bucket || null,
    coverageEnd: coverageEnd.data?.date_bucket || null,
    warning: latestRun.data?.status === "failed" ? "Latest analytics rollup failed." : null
  };
}
