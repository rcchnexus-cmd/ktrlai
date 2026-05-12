import { getWorkspacePlanState } from "./_planLimits.js";
import { checkServerRateLimit } from "./_rateLimit.js";

export function getMonthlyWindow(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    monthStart: monthStart.toISOString(),
    nextMonthStart: nextMonthStart.toISOString()
  };
}

export function validateTrackingPayloadShape(body) {
  let serializedLength = 0;

  try {
    serializedLength = JSON.stringify(body || {}).length;
  } catch {
    serializedLength = 0;
  }

  const checks = [
    [serializedLength <= 20000, "Tracking payload is too large."],
    [String(body.workspaceId || "").length <= 80, "Workspace identifier is too long."],
    [String(body.pageUrl || "").length <= 2048, "Page URL is too long."],
    [String(body.referrer || "").length <= 2048, "Referrer is too long."],
    [String(body.userAgent || "").length <= 1024, "User agent is too long."],
    [String(body.pageTitle || "").length <= 300, "Page title is too long."]
  ];

  const failedCheck = checks.find(([passes]) => !passes);
  return failedCheck ? { ok: false, message: failedCheck[1] } : { ok: true };
}

export function checkRateLimit(req, workspaceId) {
  return checkServerRateLimit(req, {
    scope: "track",
    workspaceId,
    max: 120,
    message: "Tracker rate limit exceeded. Please retry shortly."
  });
}

export async function getWorkspaceUsageState(supabase, workspaceId) {
  const planState = await getWorkspacePlanState(supabase, workspaceId);

  if (!planState.ok) {
    return {
      ...planState,
      message: "Workspace not found for usage limit check."
    };
  }

  const limit = planState.limits.events;
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
      message: `Monthly event limit reached for the ${planState.effectivePlan} plan. Upgrade to continue ingesting events.`,
      plan: planState.effectivePlan,
      limit,
      eventsUsed,
      monthStart
    };
  }

  return {
    ok: true,
    plan: planState.effectivePlan,
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
