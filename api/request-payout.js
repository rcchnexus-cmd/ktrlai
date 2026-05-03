import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";
import { requireWorkspaceRole } from "./_auth.js";
import { buildStripeConnectPayoutPlan } from "./_payouts.js";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";

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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const body = getRequestBody(req);
  const workspaceId = body.workspace_id || body.workspaceId;
  const amountCents = Number(body.amount_cents || body.amountCents || 0);
  const currency = String(body.currency || "USD").toUpperCase();

  if (!workspaceId || !amountCents || amountCents <= 0) {
    return res.status(400).json({
      ok: false,
      message: "workspace_id and a positive amount_cents are required."
    });
  }

  if (!isSupabaseAdminConfigured()) {
    return res.status(202).json({
      ok: true,
      mode: "mock",
      message: "Payout request accepted in mock mode. Authenticated payout requests are not enabled yet.",
      request: {
        id: `mock_payout_${Date.now()}`,
        workspaceId,
        amountCents,
        currency,
        status: "requested"
      }
    });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: "request payouts"
  });

  if (!auth.ok) {
    return;
  }

  if (process.env.PAYOUT_REQUESTS_ENABLED !== "true") {
    return res.status(403).json({
      ok: false,
      mode: "supabase",
      message: "Payout requests are disabled for this deployment."
    });
  }

  const { data, error } = await supabase
    .from("payout_requests")
    .insert({
      workspace_id: workspaceId,
      amount_cents: amountCents,
      currency,
      status: "requested",
      requested_by: auth.user.id,
      notes: "Stripe Connect payout execution is not enabled yet."
    })
    .select("id, workspace_id, amount_cents, currency, status, created_at")
    .single();

  if (error) {
    return res.status(500).json({
      ok: false,
      mode: "supabase",
      message: "Payout request could not be created."
    });
  }

  await recordAuditEvent(supabase, {
    workspaceId,
    actorId: auth.user.id,
    eventType: auditEventTypes.payoutRequest,
    metadata: {
      payout_request_id: data.id,
      amount_cents: amountCents,
      currency,
      status: data.status
    }
  });

  return res.status(201).json({
    ok: true,
    mode: "supabase",
    message: "Payout request created for review.",
    request: data,
    payoutPlan: buildStripeConnectPayoutPlan({
      workspaceId,
      payoutRequestId: data.id,
      amountCents,
      currency
    })
  });
}
