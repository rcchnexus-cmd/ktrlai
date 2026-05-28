const defaultPolicies = [
  { id: "policy_gptbot", botScope: "GPTBot", policyType: "monitor", notes: "Watch GPTBot activity before enforcing access." },
  { id: "policy_chatgpt_user", botScope: "ChatGPT-User", policyType: "monitor", notes: "Monitor ChatGPT browsing access and attribution paths." },
  { id: "policy_claudebot", botScope: "ClaudeBot", policyType: "monitor", notes: "Monitor Claude crawler behavior and content paths." },
  { id: "policy_perplexity", botScope: "PerplexityBot", policyType: "allow", notes: "Allow answer-engine preview access while analytics mature." },
  { id: "policy_google_extended", botScope: "Google-Extended", policyType: "restrict", notes: "Restrict training-style access unless explicitly licensed." },
  { id: "policy_unknown", botScope: "Unknown/Suspicious", policyType: "block", notes: "Treat unknown or suspicious scrapers conservatively." }
];

const scopeAliases = {
  "Unknown LLM Crawler": "Unknown/Suspicious",
  UnknownBot: "Unknown/Suspicious"
};

const accessPolicyMap = {
  "Allow full access": "allow",
  "Allow summaries only": "monitor",
  "Paid access required": "restrict",
  "Training denied": "restrict",
  "Block all access": "block"
};

export function normalizeGovernanceBotScope(value) {
  const scope = String(value || "").trim();
  return scopeAliases[scope] || scope;
}

export function accessToPolicyType(access) {
  return accessPolicyMap[access] || "monitor";
}

export function describeGovernancePolicyType(policyType) {
  const labels = {
    allow: "Allow full access",
    monitor: "Monitor access",
    restrict: "Restricted access",
    block: "Block-ready"
  };

  return labels[policyType] || labels.monitor;
}

function mergePolicies(policies = []) {
  const merged = new Map(defaultPolicies.map((policy) => [policy.botScope, policy]));

  policies.forEach((policy) => {
    const botScope = normalizeGovernanceBotScope(policy.botScope || policy.bot_scope);

    if (!botScope) {
      return;
    }

    merged.set(botScope, {
      id: policy.id || `policy_${botScope.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      botScope,
      policyType: policy.policyType || policy.policy_type || "monitor",
      notes: policy.notes || policy.detail || "",
      updatedAt: policy.updatedAt || policy.updated_at || policy.createdAt || policy.created_at || null
    });
  });

  return Array.from(merged.values());
}

function getPolicy(policies, botScope) {
  return policies.find((policy) => policy.botScope === botScope) || defaultPolicies.find((policy) => policy.botScope === botScope);
}

function createRule({ id, label, detail, policy, enabledWhen, disabledPolicyType = "monitor" }) {
  return {
    id,
    label,
    detail,
    botScope: policy.botScope,
    enabled: enabledWhen.includes(policy.policyType),
    enabledPolicyType: enabledWhen[0],
    disabledPolicyType
  };
}

export function createControlsFromEnterprise(enterprise = {}) {
  const policies = mergePolicies(enterprise.policies);
  const unknownPolicy = getPolicy(policies, "Unknown/Suspicious");
  const perplexityPolicy = getPolicy(policies, "PerplexityBot");
  const gptPolicy = getPolicy(policies, "GPTBot");
  const googlePolicy = getPolicy(policies, "Google-Extended");
  const claudePolicy = getPolicy(policies, "ClaudeBot");

  return {
    source: "enterprise",
    currentMemberRole: enterprise.currentMemberRole,
    permissions: enterprise.permissions || {},
    warnings: enterprise.warnings || [],
    rules: [
      createRule({
        id: "rule_trusted",
        label: "Allow trusted bots",
        detail: "Perplexity and verified partner crawlers remain allowed or monitored.",
        policy: perplexityPolicy,
        enabledWhen: ["allow", "monitor"],
        disabledPolicyType: "restrict"
      }),
      createRule({
        id: "rule_unknown",
        label: "Block unknown bots",
        detail: "Unknown or suspicious crawler signatures are treated conservatively.",
        policy: unknownPolicy,
        enabledWhen: ["block", "restrict"],
        disabledPolicyType: "monitor"
      }),
      createRule({
        id: "rule_depth",
        label: "Limit scraping depth",
        detail: "Claude crawler activity is restricted when deeper access needs review.",
        policy: claudePolicy,
        enabledWhen: ["restrict", "block"],
        disabledPolicyType: "monitor"
      }),
      createRule({
        id: "rule_summary",
        label: "Allow summaries only",
        detail: "GPTBot is monitored before full access or enforcement changes.",
        policy: gptPolicy,
        enabledWhen: ["monitor"],
        disabledPolicyType: "restrict"
      }),
      createRule({
        id: "rule_full",
        label: "Block full content access",
        detail: "Google-Extended training-style access is restricted unless licensed.",
        policy: googlePolicy,
        enabledWhen: ["restrict", "block"],
        disabledPolicyType: "monitor"
      })
    ],
    customRules: policies
      .filter((policy) => policy.updatedAt)
      .map((policy) => ({
        id: `custom_${policy.id}`,
        bot: policy.botScope,
        access: describeGovernancePolicyType(policy.policyType),
        createdAt: policy.updatedAt ? new Date(policy.updatedAt).toLocaleDateString() : "Saved policy"
      })),
    governancePolicies: policies.map((policy) => ({
      id: policy.id,
      botScope: policy.botScope,
      policyType: policy.policyType,
      detail: policy.notes || "Workspace policy persisted for tracker ingestion metadata.",
      notes: policy.notes,
      updatedAt: policy.updatedAt
    }))
  };
}

export function mergeSavedPolicyIntoControls(controls, savedPolicy) {
  if (!controls || !savedPolicy) {
    return controls;
  }

  const botScope = normalizeGovernanceBotScope(savedPolicy.botScope || savedPolicy.bot_scope);
  const nextPolicy = {
    id: savedPolicy.id || `policy_${botScope.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    botScope,
    policyType: savedPolicy.policyType || savedPolicy.policy_type || "monitor",
    notes: savedPolicy.notes || savedPolicy.detail || "",
    updatedAt: savedPolicy.updatedAt || savedPolicy.updated_at || new Date().toISOString()
  };

  const enterprise = {
    currentMemberRole: controls.currentMemberRole,
    permissions: controls.permissions,
    warnings: controls.warnings,
    policies: controls.governancePolicies.map((policy) =>
      normalizeGovernanceBotScope(policy.botScope) === botScope ? nextPolicy : policy
    )
  };

  if (!enterprise.policies.some((policy) => normalizeGovernanceBotScope(policy.botScope) === botScope)) {
    enterprise.policies.push(nextPolicy);
  }

  return createControlsFromEnterprise(enterprise);
}
