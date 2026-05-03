export const auditEventTypes = {
  apiKeyRotation: "api_key_rotation",
  domainVerification: "domain_verification",
  payoutRequest: "payout_request",
  planChange: "plan_change"
};

export async function recordAuditEvent(supabase, { workspaceId, actorId = null, eventType, metadata = {} } = {}) {
  if (!supabase || !workspaceId || !eventType) {
    return { ok: false };
  }

  const { error } = await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    event_type: eventType,
    metadata
  });

  return { ok: !error, error };
}
