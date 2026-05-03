import Stripe from "stripe";
import { requireWorkspaceRole } from "./_auth.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

const BILLING_CHECKOUT_DISABLED_MESSAGE =
  "Billing checkout will be enabled after backend deployment.";

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

function getBaseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost:5173";
  return process.env.APP_URL || `${protocol}://${host}`;
}

function getPriceId(plan) {
  const priceIds = {
    pro: process.env.STRIPE_PRO_PRICE_ID,
    business: process.env.STRIPE_BUSINESS_PRICE_ID
  };

  return priceIds[plan];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { plan, workspaceId, customerEmail, successUrl, cancelUrl } = getRequestBody(req);
  const normalizedPlan = String(plan || "").toLowerCase();
  const priceId = getPriceId(normalizedPlan);

  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    return res.status(501).json({ message: BILLING_CHECKOUT_DISABLED_MESSAGE });
  }

  if (!workspaceId) {
    return res.status(400).json({ message: "workspaceId is required." });
  }

  if (!isSupabaseAdminConfigured()) {
    return res.status(501).json({ message: "Authenticated billing is not configured yet." });
  }

  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceRole(supabase, req, res, {
    workspaceId,
    action: "manage billing"
  });

  if (!auth.ok) {
    return;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: customerEmail || auth.user.email || undefined,
      client_reference_id: workspaceId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl || `${baseUrl}/dashboard?checkout=success`,
      cancel_url: cancelUrl || `${baseUrl}/#pricing`,
      metadata: {
        plan: normalizedPlan,
        workspace_id: workspaceId
      },
      subscription_data: {
        metadata: {
          plan: normalizedPlan,
          workspace_id: workspaceId
        }
      }
    });

    return res.status(200).json({ url: session.url });
  } catch {
    return res.status(500).json({
      message: "Unable to create Stripe Checkout session."
    });
  }
}
