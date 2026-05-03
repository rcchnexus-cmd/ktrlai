import Stripe from "stripe";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

// Webhooks must verify Stripe's signature against the raw request body.
// If your deployment adapter parses JSON first, disable body parsing for this
// route so stripe.webhooks.constructEvent receives the original bytes.
export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function getPlanFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return "Pro";
  }

  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) {
    return "Business";
  }

  return "Free";
}

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();

  if (value === "business") {
    return "Business";
  }

  if (value === "pro") {
    return "Pro";
  }

  return "Free";
}

async function resolveWorkspaceId(supabase, { workspaceId, stripeCustomerId, stripeSubscriptionId }) {
  if (workspaceId) {
    return workspaceId;
  }

  if (stripeSubscriptionId) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  if (stripeCustomerId) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  return null;
}

async function syncSubscriptionToSupabase({
  workspaceId,
  stripeCustomerId,
  stripeSubscriptionId,
  plan,
  subscriptionStatus,
  currentPeriodEnd
}) {
  const supabase = getSupabaseAdmin();
  const resolvedWorkspaceId = await resolveWorkspaceId(supabase, {
    workspaceId,
    stripeCustomerId,
    stripeSubscriptionId
  });

  if (!resolvedWorkspaceId) {
    return {
      ok: true,
      synced: false,
      reason: "Workspace could not be resolved from Stripe metadata or stored Stripe IDs."
    };
  }

  const updates = {
    plan: normalizePlan(plan),
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    subscription_status: subscriptionStatus || "unknown",
    current_period_end: currentPeriodEnd || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", resolvedWorkspaceId)
    .select("id, plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end")
    .single();

  if (error) {
    throw error;
  }

  await recordAuditEvent(supabase, {
    workspaceId: resolvedWorkspaceId,
    eventType: auditEventTypes.planChange,
    metadata: {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan: updates.plan,
      subscription_status: updates.subscription_status,
      current_period_end: updates.current_period_end
    }
  });

  return { ok: true, synced: true, workspace: data };
}

async function handleCheckoutCompleted(session) {
  return syncSubscriptionToSupabase({
    workspaceId: session.client_reference_id || session.metadata?.workspace_id,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    plan: session.metadata?.plan,
    subscriptionStatus: "active",
    currentPeriodEnd: null
  });
}

async function handleSubscriptionUpdated(subscription) {
  const firstItem = subscription.items?.data?.[0];

  return syncSubscriptionToSupabase({
    workspaceId: subscription.metadata?.workspace_id,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    plan: getPlanFromPriceId(firstItem?.price?.id),
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(501).json({ message: "Stripe webhook is not configured." });
  }

  if (!isSupabaseAdminConfigured()) {
    return res.status(501).json({ message: "Supabase billing sync is not configured." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({
      message: "Invalid Stripe webhook signature.",
      error: error.message
    });
  }

  try {
    let syncResult = { ok: true, synced: false, reason: "Event type does not mutate billing state." };

    switch (event.type) {
      case "checkout.session.completed":
        syncResult = await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        syncResult = await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        syncResult = await syncSubscriptionToSupabase({
          workspaceId: event.data.object.metadata?.workspace_id,
          stripeCustomerId: event.data.object.customer,
          stripeSubscriptionId: event.data.object.id,
          plan: "Free",
          subscriptionStatus: event.data.object.status,
          currentPeriodEnd: event.data.object.current_period_end
            ? new Date(event.data.object.current_period_end * 1000).toISOString()
            : null
        });
        break;
      default:
        break;
    }

    return res.status(200).json({ received: true, sync: syncResult });
  } catch (error) {
    return res.status(500).json({
      message: "Stripe webhook received but subscription sync failed.",
      error: error.message
    });
  }
}
