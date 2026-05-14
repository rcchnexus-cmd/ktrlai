export const auditEventTypes = {
  login: "login",
  logout: "logout",
  apiKeyRotation: "api_key_rotation",
  apiKeyGeneration: "api_key_generation",
  domainAdded: "domain_added",
  domainRemoved: "domain_removed",
  domainVerification: "domain_verification",
  payoutRequest: "payout_request",
  planChange: "plan_change",
  stripeWebhook: "stripe_webhook",
  stripePaymentFailed: "stripe_payment_failed",
  stripeSubscriptionCanceled: "stripe_subscription_canceled",
  invitationCreated: "workspace_invitation_created",
  invitationRevoked: "workspace_invitation_revoked",
  memberRemoved: "workspace_member_removed",
  memberRoleChanged: "workspace_member_role_changed",
  governancePolicyChanged: "governance_policy_changed",
  securitySettingChanged: "security_setting_changed",
  trackerInstallVerified: "tracker_install_verified",
  suspiciousCrawlerDetected: "suspicious_crawler_detected",
  rateLimitTriggered: "rate_limit_triggered"
};

function summarizeEvent(eventType, metadata = {}) {
  const summaries = {
    [auditEventTypes.apiKeyRotation]: "API key rotated",
    [auditEventTypes.apiKeyGeneration]: "API key generated",
    [auditEventTypes.domainAdded]: "Domain added",
    [auditEventTypes.domainRemoved]: "Domain removed",
    [auditEventTypes.domainVerification]: "Domain verification checked",
    [auditEventTypes.payoutRequest]: "Payout request submitted",
    [auditEventTypes.planChange]: "Billing plan changed",
    [auditEventTypes.invitationCreated]: "Workspace invitation created",
    [auditEventTypes.invitationRevoked]: "Workspace invitation revoked",
    [auditEventTypes.memberRemoved]: "Workspace member removed",
    [auditEventTypes.memberRoleChanged]: "Workspace member role changed",
    [auditEventTypes.governancePolicyChanged]: "Governance policy updated",
    [auditEventTypes.securitySettingChanged]: "Security setting updated",
    [auditEventTypes.trackerInstallVerified]: "Tracker installation verified",
    [auditEventTypes.suspiciousCrawlerDetected]: "Suspicious crawler detected",
    [auditEventTypes.rateLimitTriggered]: "Rate limit triggered"
  };

  return metadata.event_summary || summaries[eventType] || String(eventType || "Workspace event").replace(/_/g, " ");
}

export async function recordAuditEvent(
  supabase,
  { workspaceId, actorId = null, eventType, eventSummary = "", metadata = {} } = {}
) {
  if (!supabase || !workspaceId || !eventType) {
    return { ok: false };
  }

  const summary = eventSummary || summarizeEvent(eventType, metadata);
  const auditLog = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    actor_user_id: actorId,
    event_type: eventType,
    event_summary: summary,
    metadata
  });

  if (!auditLog.error) {
    return { ok: true, error: null };
  }

  const { error } = await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    event_type: eventType,
    metadata: {
      ...metadata,
      event_summary: summary
    }
  });

  return { ok: !error, error };
}
