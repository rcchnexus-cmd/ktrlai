import { detectBot } from "./_botDetection.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import {
  compareApiKeyHash,
  getApiKeyPrefix,
  isApiKeyHashingConfigured,
  validateApiKeyFormat
} from "./_crypto.js";
import {
  checkRateLimit,
  getWorkspaceUsageState,
  updateWorkspaceUsageCounter,
  validateTrackingPayloadShape
} from "./_usageLimits.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";

const activityStatuses = new Set(["allowed", "blocked", "restricted", "paid_access", "summaries_only"]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

function getHeader(req, headerName) {
  const value = req.headers[headerName] || req.headers[headerName.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function hasValidPageUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function validateRequiredFields(body) {
  const missing = [];

  if (!body.workspaceId) {
    missing.push("workspaceId");
  }

  if (!body.apiKey) {
    missing.push("apiKey");
  }

  if (!body.pageUrl) {
    missing.push("pageUrl or url");
  } else if (!hasValidPageUrl(body.pageUrl)) {
    return {
      ok: false,
      status: 400,
      message: "pageUrl must be a valid http or https URL."
    };
  }

  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `Missing required tracking fields: ${missing.join(", ")}.`
    };
  }

  return { ok: true };
}

function normalizeTrackingBody(body, req) {
  return {
    ...body,
    workspaceId: body.workspaceId || body.workspace_id || body.dataWorkspaceId || body["data-workspace-id"],
    apiKey: body.apiKey || body.api_key || body.dataApiKey || body["data-api-key"],
    pageUrl: body.pageUrl || body.page_url || body.url || body.href,
    referrer: body.referrer ?? body.referer ?? body.referrerUrl ?? body.referrer_url ?? "",
    userAgent: body.userAgent || body.user_agent || getHeader(req, "user-agent") || "",
    timestamp: normalizeTimestamp(body.timestamp || body.occurredAt || body.occurred_at),
    pageTitle: body.pageTitle ?? body.page_title ?? body.title ?? "",
    botName: body.botName || body.bot_name || "",
    detectedBotType: body.detectedBotType || body.detected_bot_type || null,
    event: body.event || body.eventName || body.event_name || "page",
    eventId: body.eventId || body.event_id || null,
    pagePath: body.pagePath || body.page_path || body.path || "",
    screen: body.screen && typeof body.screen === "object" ? body.screen : null,
    language: body.language || "",
    timezone: body.timezone || "",
    sdk: body.sdk && typeof body.sdk === "object" ? body.sdk : null,
    properties: body.properties && typeof body.properties === "object" ? body.properties : null,
    traits: body.traits && typeof body.traits === "object" ? body.traits : null,
    anonymousId: body.anonymousId || body.anonymous_id || "",
    userId: body.userId || body.user_id || ""
  };
}

function cleanBotName(value) {
  return String(value || "UnknownBot").trim().slice(0, 120) || "UnknownBot";
}

function isMissingDetectionColumn(error) {
  const message = String(error?.message || "");
  return error?.code === "PGRST204" || /confidence_score|is_ai_bot|is_suspicious|is_search_engine|detection_method|category/i.test(message);
}

function normalizeStatus(status) {
  const normalized = String(status || "allowed")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  return activityStatuses.has(normalized) ? normalized : "allowed";
}

function parsePageUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return {
      hostname: url.hostname.replace(/^www\./, ""),
      pagePath: `${url.pathname || "/"}${url.search || ""}`
    };
  } catch {
    return {
      hostname: "",
      pagePath: "/"
    };
  }
}

function getPendingClientIpHash(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || "").split(",")[0];
  return ip ? "pending-server-hash" : null;
}

async function resolveApiKeyRecord(supabase, { workspaceId, apiKey }) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, workspace_id, key_prefix, key_hash, revoked_at")
    .eq("workspace_id", workspaceId)
    .eq("key_prefix", getApiKeyPrefix(apiKey))
    .is("revoked_at", null)
    .limit(10);

  if (error) {
    return { record: null, error };
  }

  const matchedRecord = (data || []).find((record) => compareApiKeyHash(apiKey, record.key_hash));
  return { record: matchedRecord || null, error: null };
}

async function resolveDomainId(supabase, { workspaceId, hostname }) {
  if (!hostname) {
    return null;
  }

  const { data, error } = await supabase
    .from("domains")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("hostname", hostname)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

async function insertActivityLog(supabase, eventPayload) {
  const insert = await supabase.from("activity_logs").insert(eventPayload).select("id").single();

  if (!insert.error || !isMissingDetectionColumn(insert.error)) {
    return insert;
  }

  const {
    category,
    confidence_score,
    is_ai_bot,
    is_suspicious,
    is_search_engine,
    detection_method,
    ...legacyPayload
  } = eventPayload;

  return supabase.from("activity_logs").insert(legacyPayload).select("id").single();
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = normalizeTrackingBody(getRequestBody(req), req);

  if (!body.apiKey) {
    return res.status(401).json({
      ok: false,
      message: "Missing API key."
    });
  }

  if (!validateApiKeyFormat(body.apiKey)) {
    return res.status(401).json({
      ok: false,
      message: "Invalid API key format."
    });
  }

  const requiredFields = validateRequiredFields(body);

  if (!requiredFields.ok) {
    return res.status(requiredFields.status).json({
      ok: false,
      message: requiredFields.message
    });
  }

  const payloadShape = validateTrackingPayloadShape(body);

  if (!payloadShape.ok) {
    return res.status(413).json({
      ok: false,
      message: payloadShape.message
    });
  }

  const rateLimit = checkRateLimit(req, body.workspaceId);

  if (!rateLimit.ok) {
    return res.status(429).json({
      ok: false,
      message: rateLimit.message
    });
  }

  const detection = detectBot({
    userAgent: body.userAgent,
    headers: req.headers,
    referrer: body.referrer
  });
  const detectedBotType = detection.bot_type;
  const parsedUrl = parsePageUrl(body.pageUrl);
  const status = normalizeStatus(body.status);
  const eventPayload = {
    workspace_id: String(body.workspaceId),
    url: String(body.pageUrl),
    referrer: String(body.referrer || ""),
    user_agent: String(body.userAgent),
    occurred_at: String(body.timestamp),
    page_title: String(body.pageTitle || ""),
    bot_name: cleanBotName(body.botName || detection.bot_name),
    bot_type: detectedBotType,
    category: detection.category,
    confidence_score: detection.confidence_score,
    is_ai_bot: detection.is_ai_bot,
    is_search_engine: detection.is_search_engine,
    is_suspicious: detection.is_suspicious,
    detection_method: detection.detection_method,
    page_path: String(body.pagePath || parsedUrl.pagePath).slice(0, 500),
    status,
    domain_id: null,
    ip_hash: getPendingClientIpHash(req),
    metadata: {
      source: "tracker",
      detection,
      detected_bot_type: detectedBotType,
      detected_bot_name: detection.bot_name,
      detection_category: detection.category,
      confidence_score: detection.confidence_score,
      is_ai_bot: detection.is_ai_bot,
      is_search_engine: detection.is_search_engine,
      is_suspicious: detection.is_suspicious,
      detection_method: detection.detection_method,
      client_detected_bot_type: body.detectedBotType || null,
      event: String(body.event || "page").slice(0, 80),
      event_id: body.eventId ? String(body.eventId).slice(0, 120) : null,
      sdk: body.sdk,
      screen: body.screen,
      language: String(body.language || "").slice(0, 40),
      timezone: String(body.timezone || "").slice(0, 80),
      properties: body.properties,
      traits: body.traits,
      anonymous_id: String(body.anonymousId || "").slice(0, 180),
      user_id: String(body.userId || "").slice(0, 180),
      hostname: parsedUrl.hostname,
      page_url: String(body.pageUrl),
      referrer: String(body.referrer || ""),
      page_title: String(body.pageTitle || "")
    }
  };

  if (!isSupabaseAdminConfigured() || !isApiKeyHashingConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "Tracking event accepted in local development mode.",
      detectedBotType,
      detection,
      event: eventPayload
    });
  }

  const supabase = getSupabaseAdmin();
  const { record: apiKeyRecord, error: apiKeyError } = await resolveApiKeyRecord(supabase, {
    workspaceId: eventPayload.workspace_id,
    apiKey: body.apiKey
  });

  if (apiKeyError) {
    return res.status(401).json({
      ok: false,
      mode: "live",
      message: "API key could not be validated."
    });
  }

  if (!apiKeyRecord) {
    return res.status(401).json({
      ok: false,
      mode: "live",
      message: "Invalid or revoked API key."
    });
  }

  const usageState = await getWorkspaceUsageState(supabase, eventPayload.workspace_id);

  if (!usageState.ok) {
    return res.status(usageState.status || 429).json({
      ok: false,
      mode: "live",
      message: usageState.message,
      usage: {
        plan: usageState.plan,
        limit: usageState.limit,
        eventsUsed: usageState.eventsUsed,
        monthStart: usageState.monthStart
      }
    });
  }

  eventPayload.domain_id = await resolveDomainId(supabase, {
    workspaceId: eventPayload.workspace_id,
    hostname: parsedUrl.hostname
  });

  const { data: insertedEvent, error: insertError } = await insertActivityLog(supabase, eventPayload);

  if (insertError) {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "Tracking event could not be stored."
    });
  }

  const { error: updateError } = await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyRecord.id);

  const usageCounterResult = await updateWorkspaceUsageCounter(supabase, {
    workspaceId: eventPayload.workspace_id,
    usageState
  });

  if (updateError) {
    return res.status(202).json({
      ok: true,
      mode: "live",
      message: "Tracking event stored, but API key last-used timestamp was not updated.",
      detectedBotType,
      detection,
      eventId: insertedEvent.id,
      usage: {
        plan: usageState.plan,
        limit: usageState.limit,
        eventsUsed: usageState.eventsUsed + 1,
        counterUpdated: usageCounterResult.ok
      }
    });
  }

  return res.status(201).json({
    ok: true,
    mode: "live",
    message: "Tracking event stored.",
    detectedBotType,
    detection,
    eventId: insertedEvent.id,
    usage: {
      plan: usageState.plan,
      limit: usageState.limit,
      eventsUsed: usageState.eventsUsed + 1,
      counterUpdated: usageCounterResult.ok
    }
  });
}
