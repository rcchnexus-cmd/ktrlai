const minuteBuckets = new Map();

export const planUsageLimits = {
  free: 1000,
  pro: 100000,
  business: 1000000
};

const rateWindowMs = 60 * 1000;
const maxRequestsPerWindow = 120;

function normalizePlan(plan) {
  return String(plan || "Free").trim().toLowerCase();
}

function getClientIdentity(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || "").split(",")[0];
  return ip || req.headers["x-real-ip"] || "unknown";
}

export function getMonthlyWindow(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    monthStart: monthStart.toISOString(),
    nextMonthStart: nextMonthStart.toISOString()
  };
}

export function validateTrackingPayloadShape(body) {
  const checks = [
    [String(body.workspaceId || "").length <= 80, "Workspace identifier is too long."],
    [String(body.pageUrl || "").length <= 2048, "Page URL is too long."],
    [String(body.referrer || "").length <= 2048, "Referrer is too long."],
    [String(body.userAgent || "").length <= 512, "User agent is too long."],
    [String(body.pageTitle || "").length <= 300, "Page title is too long."]
  ];

  const failedCheck = checks.find(([passes]) => !passes);
  return failedCheck ? { ok: false, message: failedCheck[1] } : { ok: true };
}

export function checkRateLimit(req, workspaceId) {
  const now = Date.now();
  const bucket = Math.floor(now / rateWindowMs);
  const key = `${workspaceId || "unknown"}:${getClientIdentity(req)}:${bucket}`;
  const currentCount = minuteBuckets.get(key) || 0;

  if (currentCount >= maxRequestsPerWindow) {
    return {
      ok: false,
      message: "Rate limit exceeded. Please retry shortly."
    };
  }

  minuteBuckets.set(key, currentCount + 1);

  for (const storedKey of minuteBuckets.keys()) {
    if (!storedKey.endsWith(`:${bucket}`)) {
      minuteBuckets.delete(storedKey);
    }
  }

  return { ok: true };
}

export async function getWorkspaceUsageState(supabase, workspaceId) {
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, plan")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return {
      ok: false,
      status: 404,
      message: "Workspace not found for usage limit check."
    };
  }

  const planKey = normalizePlan(workspace.plan);
  const limit = planUsageLimits[planKey] || planUsageLimits.free;
  const { monthStart, nextMonthStart } = getMonthlyWindow();
  const { count, error: countError } = await supabase
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("occurred_at", monthStart)
    .lt("occurred_at", nextMonthStart);

  if (countError) {
    return {
      ok: false,
      status: 500,
      message: "Monthly usage could not be checked."
    };
  }

  const eventsUsed = count || 0;

  if (eventsUsed >= limit) {
    return {
      ok: false,
      status: 429,
      message: `Monthly event limit reached for the ${workspace.plan || "Free"} plan.`,
      plan: workspace.plan || "Free",
      limit,
      eventsUsed,
      monthStart
    };
  }

  return {
    ok: true,
    plan: workspace.plan || "Free",
    limit,
    eventsUsed,
    monthStart,
    nextMonthStart
  };
}

export async function updateWorkspaceUsageCounter(supabase, { workspaceId, usageState }) {
  const nextEventsUsed = (usageState.eventsUsed || 0) + 1;

  const { error } = await supabase
    .from("workspace_usage_months")
    .upsert(
      {
        workspace_id: workspaceId,
        month_start: String(usageState.monthStart).slice(0, 10),
        events_used: nextEventsUsed,
        event_limit: usageState.limit,
        plan: usageState.plan,
        updated_at: new Date().toISOString()
      },
      { onConflict: "workspace_id,month_start" }
    );

  return { ok: !error, error };
}
