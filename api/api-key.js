import { createWorkspaceApiKeyRecord } from "./_apiKeys.js";
import { generateApiKey, isApiKeyHashingConfigured, maskApiKey } from "./_crypto.js";
import { requireWorkspaceRole } from "./_auth.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { allowLocalMockFallback, getAppUrl, sendMissingServerConfig } from "./_runtime.js";
import { enforceWorkspaceResourceLimit } from "./_planLimits.js";
import { checkServerRateLimit, recordRateLimitTrigger } from "./_rateLimit.js";

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

function buildTrackerSnippet({ workspaceId, apiKey, req }) {
  return `<script src="${getAppUrl(req)}/tracker.js" data-workspace-id="${workspaceId}" data-api-key="${apiKey}"></script>`;
}

function toClientApiKey({ apiKey, record }) {
  return {
    id: record?.id || `mock_key_${Date.now()}`,
    key: apiKey,
    maskedKey: maskApiKey(apiKey),
    keyPrefix: record?.key_prefix || apiKey.slice(0, 18),
    lastUsedAt: record?.last_used_at || null,
    rotatedAt: record?.created_at || new Date().toISOString(),
    oneTimeReveal: true
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
  const action = String(body.action || "rotate").toLowerCase();
  const name = body.name || "Default key";

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: "workspace_id is required." });
  }

  if (!["generate", "rotate"].includes(action)) {
    return res.status(400).json({ ok: false, message: "Unsupported API key action." });
  }

  const rateLimit = checkServerRateLimit(req, {
    scope: "api_key",
    workspaceId,
    max: 30,
    message: "Too many API key requests. Please retry shortly."
  });

  if (!rateLimit.ok) {
    if (isSupabaseAdminConfigured()) {
      await recordRateLimitTrigger(getSupabaseAdmin(), {
        workspaceId,
        scope: "api_key",
        reason: "api_key_mutation_limit"
      });
    }

    return res.status(429).json({ ok: false, message: rateLimit.message });
  }

  if (!isSupabaseAdminConfigured() || !isApiKeyHashingConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    const apiKey = generateApiKey();
    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "API key generated in local development mode. Configure Supabase admin and API_KEY_HASH_SECRET for persisted keys.",
      apiKey: toClientApiKey({ apiKey }),
      script: buildTrackerSnippet({ workspaceId, apiKey, req })
    });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: `${action} workspace API keys`
  });

  if (!auth.ok) {
    return;
  }

  try {
    if (action === "generate") {
      const { count, error: countError } = await supabase
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .is("revoked_at", null);

      if (countError) {
        return res.status(500).json({
          ok: false,
          mode: "live",
          message: "API key limit could not be checked."
        });
      }

      const limitState = await enforceWorkspaceResourceLimit(supabase, {
        workspaceId,
        resource: "apiKeys",
        currentCount: count || 0,
        nextCount: (count || 0) + 1,
        upgradeMessage: "API key limit reached for this plan. Upgrade to add more keys, or rotate an existing key."
      });

      if (!limitState.ok) {
        return res.status(limitState.status || 402).json({
          ok: false,
          mode: "live",
          message: limitState.message,
          limit: {
            resource: "apiKeys",
            plan: limitState.plan,
            max: limitState.limit,
            current: limitState.currentCount
          }
        });
      }
    }

    const result = await createWorkspaceApiKeyRecord(supabase, {
      workspaceId,
      name,
      revokeExisting: action === "rotate",
      actorId: auth.user.id
    });

    const apiKey = toClientApiKey(result);

    return res.status(201).json({
      ok: true,
      mode: "live",
      message: action === "rotate" ? "API key rotated." : "API key generated.",
      apiKey,
      script: buildTrackerSnippet({ workspaceId, apiKey: result.apiKey, req })
    });
  } catch {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "API key could not be generated."
    });
  }
}
