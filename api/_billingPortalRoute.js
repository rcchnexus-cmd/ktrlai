import Stripe from "stripe";
import { requireWorkspaceRole } from "./_auth.js";
import { allowLocalMockFallback, getAppUrl, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { checkServerRateLimit, recordRateLimitTrigger, rateLimitExceededResponse } from "./_rateLimit.js";

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

  if (!workspaceId) {
    return res.status(400).json({ ok: false, message: "workspace_id is required." });
  }

  const rateLimit = await checkServerRateLimit(req, {
    scope: "billing_portal",
    workspaceId,
    action: "portal",
    route: "/api/billing",
    max: 25,
    message: "Too many billing portal requests. Please retry shortly."
  });

  if (!rateLimit.ok) {
    if (isSupabaseAdminConfigured()) {
      await recordRateLimitTrigger(getSupabaseAdmin(), {
        workspaceId,
        scope: "billing_portal",
        reason: "billing_portal_limit",
        metadata: { provider: rateLimit.provider, reset_at: rateLimit.resetAt }
      });
    }

    return res.status(429).json(rateLimitExceededResponse(rateLimit));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({
      ok: false,
      mode: "live",
      message: "Stripe Billing Portal is not configured."
    });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(501).json({
      ok: false,
      mode: "mock",
      message: "Authenticated billing portal is not configured in local development."
    });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: "manage billing"
  });

  if (!auth.ok) {
    return;
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, stripe_customer_id, stripe_subscription_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "Workspace billing profile could not be loaded."
    });
  }

  if (!workspace?.stripe_customer_id) {
    return res.status(400).json({
      ok: false,
      mode: "live",
      message: "Billing portal is available after a Stripe customer is created for this workspace."
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = getAppUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: body.returnUrl || `${baseUrl}/settings?billing=portal_return`
    });

    return res.status(200).json({
      ok: true,
      mode: "live",
      url: session.url
    });
  } catch {
    return res.status(500).json({
      ok: false,
      mode: "live",
      message: "Unable to create Stripe Billing Portal session."
    });
  }
}
