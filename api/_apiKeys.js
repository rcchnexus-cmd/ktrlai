import { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKey } from "./_crypto.js";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";

export async function createWorkspaceApiKeyRecord(
  supabase,
  { workspaceId, name = "Default key", revokeExisting = true, actorId = null } = {}
) {
  if (!workspaceId) {
    throw new Error("workspaceId is required to create an API key.");
  }

  const apiKey = generateApiKey();
  const now = new Date().toISOString();

  if (revokeExisting) {
    await supabase
      .from("api_keys")
      .update({ revoked_at: now })
      .eq("workspace_id", workspaceId)
      .is("revoked_at", null);
  }

  const record = {
    workspace_id: workspaceId,
    name,
    key_prefix: getApiKeyPrefix(apiKey),
    key_hash: hashApiKey(apiKey),
    last_used_at: null,
    revoked_at: null,
    created_at: now
  };

  const { data, error } = await supabase
    .from("api_keys")
    .insert(record)
    .select("id, workspace_id, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (error) {
    throw error;
  }

  await recordAuditEvent(supabase, {
    workspaceId,
    actorId,
    eventType: revokeExisting ? auditEventTypes.apiKeyRotation : auditEventTypes.apiKeyGeneration,
    metadata: {
      api_key_id: data.id,
      key_prefix: data.key_prefix,
      revoked_existing: revokeExisting
    }
  });

  return {
    apiKey,
    record: {
      ...data,
      maskedKey: maskApiKey(apiKey)
    }
  };
}
