import { classifyUserAgent } from "../src/backend/aiDetection.js";
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

function hasRequiredFields(body) {
  return Boolean(
    body.workspaceId &&
      body.apiKey &&
      body.pageUrl &&
      body.userAgent &&
      body.timestamp &&
      body.pageTitle !== undefined
  );
}

function normalizeTrackingBody(body) {
  return {
    ...body,
    workspaceId: body.workspaceId || body.dataWorkspaceId || body["data-workspace-id"],
    apiKey: body.apiKey || body.dataApiKey || body["data-api-key"]
  };
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

function getClientIpHashPlaceholder(req) {
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

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = normalizeTrackingBody(getRequestBody(req));

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

  if (!hasRequiredFields(body)) {
    return res.status(400).json({
      ok: false,
      message: "Missing required tracking fields."
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

  const detectedBotType = classifyUserAgent(body.userAgent);
  const parsedUrl = parsePageUrl(body.pageUrl);
  const status = normalizeStatus(body.status);
  const eventPayload = {
    workspace_id: String(body.workspaceId),
    url: String(body.pageUrl),
    referrer: String(body.referrer || ""),
    user_agent: String(body.userAgent),
    occurred_at: String(body.timestamp),
    page_title: String(body.pageTitle || ""),
    bot_name: detectedBotType,
    bot_type: detectedBotType,
    page_path: parsedUrl.pagePath,
    status,
    domain_id: null,
    ip_hash: getClientIpHashPlaceholder(req),
    metadata: {
      source: "tracker",
      detected_bot_type: detectedBotType,
      client_detected_bot_type: body.detectedBotType || null,
      hostname: parsedUrl.hostname,
      page_url: String(body.pageUrl),
      referrer: String(body.referrer || ""),
      page_title: String(body.pageTitle || "")
    }
  };

  if (!isSupabaseAdminConfigured() || !isApiKeyHashingConfigured()) {
    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "Tracking event accepted in mock ingestion mode.",
      detectedBotType,
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
      mode: "supabase",
      message: "API key could not be validated."
    });
  }

  if (!apiKeyRecord) {
    return res.status(401).json({
      ok: false,
      mode: "supabase",
      message: "Invalid or revoked API key."
    });
  }

  const usageState = await getWorkspaceUsageState(supabase, eventPayload.workspace_id);

  if (!usageState.ok) {
    return res.status(usageState.status || 429).json({
      ok: false,
      mode: "supabase",
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

  const { data: insertedEvent, error: insertError } = await supabase
    .from("activity_logs")
    .insert(eventPayload)
    .select("id")
    .single();

  if (insertError) {
    return res.status(500).json({
      ok: false,
      mode: "supabase",
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
      mode: "supabase",
      message: "Tracking event stored, but API key last-used timestamp was not updated.",
      detectedBotType,
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
    mode: "supabase",
    message: "Tracking event stored.",
    detectedBotType,
    eventId: insertedEvent.id,
    usage: {
      plan: usageState.plan,
      limit: usageState.limit,
      eventsUsed: usageState.eventsUsed + 1,
      counterUpdated: usageCounterResult.ok
    }
  });
}
