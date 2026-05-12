const defaultPolicyByCategory = {
  ai_training: "restrict",
  ai_assistant: "monitor",
  search_engine: "allow",
  social_preview: "allow",
  scraper: "block",
  unknown: "monitor",
  browser: "allow"
};

function candidateScopes(detection = {}) {
  const candidates = [
    detection.bot_name,
    detection.normalized_name,
    detection.bot_type,
    detection.is_suspicious ? "Unknown/Suspicious" : "",
    detection.category === "unknown" ? "Unknown/Suspicious" : ""
  ];

  return Array.from(new Set(candidates.map((item) => String(item || "").trim()).filter(Boolean)));
}

export async function evaluateAiPolicy(supabase, { workspaceId, detection } = {}) {
  const scopes = candidateScopes(detection);
  const defaultPolicy = defaultPolicyByCategory[detection?.category] || "monitor";

  if (!supabase || !workspaceId || scopes.length === 0) {
    return {
      policyType: defaultPolicy,
      botScope: detection?.bot_name || detection?.bot_type || "Unknown",
      source: "default",
      enforcement: "visibility_only"
    };
  }

  const { data, error } = await supabase
    .from("ai_policies")
    .select("id, bot_scope, policy_type, notes")
    .eq("workspace_id", workspaceId)
    .in("bot_scope", scopes)
    .limit(1);

  if (error || !data?.length) {
    return {
      policyType: defaultPolicy,
      botScope: scopes[0],
      source: "default",
      enforcement: "visibility_only"
    };
  }

  return {
    policyId: data[0].id,
    policyType: data[0].policy_type || defaultPolicy,
    botScope: data[0].bot_scope,
    notes: data[0].notes || "",
    source: "workspace_policy",
    enforcement: "visibility_only"
  };
}
