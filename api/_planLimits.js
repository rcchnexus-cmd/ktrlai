const inactiveSubscriptionStatuses = new Set(["canceled", "incomplete", "incomplete_expired", "unpaid"]);

export const planLimits = {
  free: {
    name: "Free",
    domains: 1,
    apiKeys: 1,
    events: 1000
  },
  pro: {
    name: "Pro",
    domains: 10,
    apiKeys: 10,
    events: 100000
  },
  business: {
    name: "Business",
    domains: 1000000,
    apiKeys: 1000000,
    events: 10000000
  }
};

export function normalizePlan(plan) {
  const value = String(plan || "Free").trim().toLowerCase();

  if (value === "business") {
    return "business";
  }

  if (value === "pro") {
    return "pro";
  }

  return "free";
}

export function getEffectivePlanKey(plan, subscriptionStatus) {
  const planKey = normalizePlan(plan);
  const status = String(subscriptionStatus || "").trim().toLowerCase();

  if (planKey !== "free" && inactiveSubscriptionStatuses.has(status)) {
    return "free";
  }

  return planKey;
}

export function getPlanLimit(plan, subscriptionStatus, resource) {
  const effectivePlanKey = getEffectivePlanKey(plan, subscriptionStatus);
  return planLimits[effectivePlanKey]?.[resource] ?? planLimits.free[resource];
}

export async function getWorkspacePlanState(supabase, workspaceId) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, plan, subscription_status, current_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !workspace) {
    return {
      ok: false,
      status: 404,
      message: "Workspace not found for plan limit check."
    };
  }

  const effectivePlanKey = getEffectivePlanKey(workspace.plan, workspace.subscription_status);
  const limits = planLimits[effectivePlanKey] || planLimits.free;

  return {
    ok: true,
    workspace,
    plan: workspace.plan || "Free",
    effectivePlan: limits.name,
    subscriptionStatus: workspace.subscription_status || "free",
    limits
  };
}

export async function enforceWorkspaceResourceLimit(
  supabase,
  { workspaceId, resource, currentCount, nextCount, upgradeMessage } = {}
) {
  const planState = await getWorkspacePlanState(supabase, workspaceId);

  if (!planState.ok) {
    return planState;
  }

  const limit = planState.limits[resource];
  const next = Number.isFinite(Number(nextCount)) ? Number(nextCount) : Number(currentCount || 0) + 1;

  if (next > limit) {
    return {
      ok: false,
      status: 402,
      mode: "live",
      message:
        upgradeMessage ||
        `${planState.effectivePlan} plan limit reached. Upgrade to add more ${resource === "apiKeys" ? "API keys" : resource}.`,
      plan: planState.effectivePlan,
      limit,
      currentCount: currentCount || 0
    };
  }

  return {
    ok: true,
    plan: planState.effectivePlan,
    limit,
    currentCount: currentCount || 0
  };
}
