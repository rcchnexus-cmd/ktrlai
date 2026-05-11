import { getSupabaseAccessToken } from "../lib/supabaseClient.js";

class AnalyticsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AnalyticsApiError";
    this.status = status;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatMoneyFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(cents || 0) / 100);
}

function normalizeTraffic(data = []) {
  return data.map((item) => ({
    label: item.label,
    value: Number(item.value || 0)
  }));
}

function normalizeDistribution(data = []) {
  return data.map((item) => ({
    label: item.label,
    value: Number(item.value || 0),
    count: Number(item.count || 0),
    color: item.color || "#5B8CFF"
  }));
}

function getDataMode(summary) {
  if (summary?.hasRealData) {
    return {
      source: "live",
      sourceLabel: "Live data",
      sourceDetail: "Showing real tracker events from this workspace."
    };
  }

  return {
    source: "empty",
    sourceLabel: "Awaiting tracking data",
    sourceDetail: "Install your tracker to start seeing live AI access analytics."
  };
}

export async function getWorkspaceAnalyticsSummary({ workspaceId, range = "7d" } = {}) {
  const accessToken = await getSupabaseAccessToken();

  if (!accessToken || !workspaceId) {
    throw new AnalyticsApiError("Sign in and select a workspace before loading analytics.", 401);
  }

  const search = new URLSearchParams({
    workspace_id: workspaceId,
    range
  });
  const response = await fetch(`/api/analytics/summary?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok || data.ok === false) {
    throw new AnalyticsApiError(data.message || "Analytics could not be loaded.", response.status);
  }

  return data;
}

export function toDashboardView(summary) {
  const mode = getDataMode(summary);
  const totalEvents = Number(summary?.totalEvents || 0);
  const uniqueBots = Number(summary?.uniqueBots || 0);
  const pagesAccessed = Number(summary?.pagesAccessed || 0);
  const revenueCents = Number(summary?.revenueEstimate?.amountCents || 0);

  return {
    ...mode,
    workspaceId: summary?.workspaceId || null,
    range: summary?.range || "7d",
    hasRealData: Boolean(summary?.hasRealData),
    kpis: [
      { label: "Total AI Visits", value: formatNumber(totalEvents), change: mode.sourceLabel, tone: totalEvents > 0 ? "positive" : "neutral" },
      { label: "Unique AI Bots", value: formatNumber(uniqueBots), change: `${formatNumber(uniqueBots)} detected`, tone: uniqueBots > 0 ? "positive" : "neutral" },
      { label: "Pages Accessed", value: formatNumber(pagesAccessed), change: `${formatNumber(pagesAccessed)} pages`, tone: pagesAccessed > 0 ? "positive" : "neutral" },
      { label: "Revenue from AI", value: formatMoneyFromCents(revenueCents), change: "Estimated", tone: revenueCents > 0 ? "positive" : "neutral" }
    ],
    traffic: normalizeTraffic(summary?.trafficOverTime),
    botDistribution: normalizeDistribution(summary?.botDistribution),
    recentActivity: (summary?.recentActivity || []).slice(0, 5)
  };
}

export function toAnalyticsView(summary) {
  const mode = getDataMode(summary);

  return {
    ...mode,
    workspaceId: summary?.workspaceId || null,
    range: summary?.range || "7d",
    hasRealData: Boolean(summary?.hasRealData),
    trend: normalizeTraffic(summary?.trafficOverTime),
    topPages: (summary?.topPages || []).map((row) => ({
      page: row.page,
      visits: formatNumber(row.visits),
      revenue: formatMoneyFromCents(row.revenueEstimateCents)
    })),
    botFrequency: (summary?.botDistribution || []).map((item) => ({
      bot: item.label,
      requests: Number(item.count || 0)
    })),
    sources: normalizeDistribution(summary?.botDistribution),
    allowedBlockedCounts: summary?.allowedBlockedCounts || {},
    revenueEstimate: summary?.revenueEstimate || { amountCents: 0, formatted: "$0" }
  };
}

export function toActivityRows(summary) {
  return (summary?.recentActivity || []).map((row) => ({
    id: row.id,
    bot: row.bot,
    type: row.type,
    page: row.page,
    status: row.status,
    date: row.date,
    time: row.time,
    tokens: row.tokens,
    region: row.region
  }));
}

export function createEmptyDashboard() {
  return {
    source: "empty",
    sourceLabel: "Awaiting tracking data",
    sourceDetail: "Install your tracker to start seeing live AI access analytics.",
    hasRealData: false,
    kpis: [
      { label: "Total AI Visits", value: "0", change: "Awaiting tracking data", tone: "neutral" },
      { label: "Unique AI Bots", value: "0", change: "No events yet", tone: "neutral" },
      { label: "Pages Accessed", value: "0", change: "No events yet", tone: "neutral" },
      { label: "Revenue from AI", value: "$0", change: "No revenue yet", tone: "neutral" }
    ],
    traffic: [],
    botDistribution: [],
    recentActivity: []
  };
}

export function createEmptyAnalytics() {
  return {
    source: "empty",
    sourceLabel: "Awaiting tracking data",
    sourceDetail: "Install your tracker to start seeing live AI access analytics.",
    hasRealData: false,
    trend: [],
    topPages: [],
    botFrequency: [],
    sources: [],
    allowedBlockedCounts: {},
    revenueEstimate: { amountCents: 0, formatted: "$0" }
  };
}

export function createActivityMeta(summary) {
  return { ...getDataMode(summary), loaded: true };
}

export function decorateSampleDashboard(data) {
  return {
    ...data,
    source: "sample",
    sourceLabel: "Sample preview",
    sourceDetail: "Investor sample data is shown until this workspace receives live tracker events.",
    hasRealData: false
  };
}

export function decorateSampleAnalytics(data) {
  return {
    ...data,
    source: "sample",
    sourceLabel: "Sample preview",
    sourceDetail: "Investor sample data is shown until this workspace receives live tracker events.",
    hasRealData: false
  };
}

export function createSampleActivityMeta() {
  return {
    source: "sample",
    sourceLabel: "Sample preview",
    sourceDetail: "Investor sample activity is shown until this workspace receives live tracker events.",
    loaded: true
  };
}

export function createEmptyActivityMeta() {
  return {
    source: "empty",
    sourceLabel: "Awaiting tracking data",
    sourceDetail: "Install your tracker to start collecting AI access events.",
    loaded: true
  };
}
