import { createWorkspaceApiKeyRecord } from "./_apiKeys.js";
import { generateApiKey, isApiKeyHashingConfigured, maskApiKey } from "./_crypto.js";
import { requireWorkspaceRole } from "./_auth.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

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

function buildTrackerSnippet({ workspaceId, apiKey }) {
  return `<script src="https://ktrlai.app/tracker.js" data-workspace-id="${workspaceId}" data-api-key="${apiKey}"></script>`;
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

  if (!isSupabaseAdminConfigured() || !isApiKeyHashingConfigured()) {
    const apiKey = generateApiKey();
    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "API key generated in mock mode. Configure Supabase admin and API_KEY_HASH_SECRET for persisted keys.",
      apiKey: toClientApiKey({ apiKey }),
      script: buildTrackerSnippet({ workspaceId, apiKey })
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
    const result = await createWorkspaceApiKeyRecord(supabase, {
      workspaceId,
      name,
      revokeExisting: action === "rotate",
      actorId: auth.user.id
    });

    const apiKey = toClientApiKey(result);

    return res.status(201).json({
      ok: true,
      mode: "supabase",
      message: action === "rotate" ? "API key rotated." : "API key generated.",
      apiKey,
      script: buildTrackerSnippet({ workspaceId, apiKey: result.apiKey })
    });
  } catch {
    return res.status(500).json({
      ok: false,
      mode: "supabase",
      message: "API key could not be generated."
    });
  }
}
