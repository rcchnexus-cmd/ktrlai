import Stripe from "stripe";
import { auditEventTypes, recordAuditEvent } from "./_audit.js";
import { sendBillingActivatedEmail, sendPaymentFailedEmail } from "./_notifications.js";
import { allowLocalMockFallback, sendMissingServerConfig } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

// Webhooks must verify Stripe's signature against the raw request body.
// If your deployment adapter parses JSON first, disable body parsing for this
// route so stripe.webhooks.constructEvent receives the original bytes.
export const config = {
  api: {
    bodyParser: false
  }
};

const inactiveSubscriptionStatuses = new Set(["canceled", "incomplete", "incomplete_expired", "unpaid"]);

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

function getPlanForSubscriptionStatus(plan, subscriptionStatus) {
  const normalizedPlan = normalizePlan(plan);
  const status = String(subscriptionStatus || "").toLowerCase();

  return inactiveSubscriptionStatuses.has(status) ? "Free" : normalizedPlan;
}

function getStripeId(value) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id || null;
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
    plan: getPlanForSubscriptionStatus(plan, subscriptionStatus),
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

  if (["active", "trialing"].includes(String(updates.subscription_status || "").toLowerCase()) && updates.plan !== "Free") {
    await sendBillingActivatedEmail(supabase, {
      workspaceId: resolvedWorkspaceId,
      plan: updates.plan
    });
  }

  return { ok: true, synced: true, workspace: data };
}

async function handleCheckoutCompleted(stripe, session) {
  const subscriptionId = getStripeId(session.subscription);
  const customerId = getStripeId(session.customer);

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"]
      });

      return handleSubscriptionUpdated(subscription);
    } catch {
      // Fall back to the checkout metadata if the subscription is not
      // immediately retrievable; the subscription webhook will reconcile it.
    }
  }

  return syncSubscriptionToSupabase({
    workspaceId: session.client_reference_id || session.metadata?.workspace_id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan: session.metadata?.plan,
    subscriptionStatus: "active",
    currentPeriodEnd: null
  });
}

async function handleSubscriptionUpdated(subscription) {
  const firstItem = subscription.items?.data?.[0];

  return syncSubscriptionToSupabase({
    workspaceId: subscription.metadata?.workspace_id,
    stripeCustomerId: getStripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    plan: subscription.metadata?.plan || getPlanFromPriceId(firstItem?.price?.id),
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null
  });
}

async function createWebhookProcessingRecord(supabase, event) {
  const { data: existing, error: existingError } = await supabase
    .from("stripe_webhook_events")
    .select("id, status")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return { duplicate: true };
  }

  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    status: "processing",
    metadata: {
      livemode: Boolean(event.livemode),
      stripe_api_version: event.api_version || null
    }
  });

  if (error) {
    if (error.code === "23505") {
      return { duplicate: true };
    }

    throw error;
  }

  return { duplicate: false };
}

async function updateWebhookProcessingRecord(supabase, eventId, updates) {
  await supabase
    .from("stripe_webhook_events")
    .update({
      ...updates,
      processed_at: new Date().toISOString()
    })
    .eq("event_id", eventId);
}

async function resolveWorkspaceIdFromInvoice(supabase, invoice) {
  return resolveWorkspaceId(supabase, {
    workspaceId: invoice.metadata?.workspace_id || invoice.subscription_details?.metadata?.workspace_id,
    stripeCustomerId: getStripeId(invoice.customer),
    stripeSubscriptionId: getStripeId(invoice.subscription)
  });
}

async function handleInvoicePaymentFailed(supabase, invoice) {
  const workspaceId = await resolveWorkspaceIdFromInvoice(supabase, invoice);

  if (workspaceId) {
    await recordAuditEvent(supabase, {
      workspaceId,
      eventType: auditEventTypes.stripePaymentFailed,
      metadata: {
        stripe_customer_id: getStripeId(invoice.customer),
        stripe_subscription_id: getStripeId(invoice.subscription),
        invoice_status: invoice.status || null,
        amount_due: invoice.amount_due || null
      }
    });

    await sendPaymentFailedEmail(supabase, {
      workspaceId,
      amountDue: invoice.amount_due || null
    });
  }

  return {
    ok: true,
    synced: Boolean(workspaceId),
    workspaceId,
    reason: workspaceId ? "Payment failure audit recorded." : "Workspace could not be resolved for payment failure."
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(501).json({ ok: false, mode: "mock", message: "Stripe webhook is not configured in local development." });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!allowLocalMockFallback()) {
      return sendMissingServerConfig(res);
    }

    return res.status(501).json({ ok: false, mode: "mock", message: "Supabase billing sync is not configured in local development." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({
      message: "Invalid Stripe webhook signature."
    });
  }

  const supabase = getSupabaseAdmin();

  try {
    const processing = await createWebhookProcessingRecord(supabase, event);

    if (processing.duplicate) {
      return res.status(200).json({
        received: true,
        duplicate: true
      });
    }
  } catch {
    return res.status(500).json({
      message: "Stripe webhook idempotency record could not be created."
    });
  }

  try {
    let syncResult = { ok: true, synced: false, reason: "Event type does not mutate billing state." };

    switch (event.type) {
      case "checkout.session.completed":
        syncResult = await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        syncResult = await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        syncResult = await syncSubscriptionToSupabase({
          workspaceId: event.data.object.metadata?.workspace_id,
          stripeCustomerId: getStripeId(event.data.object.customer),
          stripeSubscriptionId: event.data.object.id,
          plan: "Free",
          subscriptionStatus: event.data.object.status,
          currentPeriodEnd: event.data.object.current_period_end
            ? new Date(event.data.object.current_period_end * 1000).toISOString()
            : null
        });

        if (syncResult.synced) {
          await recordAuditEvent(supabase, {
            workspaceId: syncResult.workspace.id,
            eventType: auditEventTypes.stripeSubscriptionCanceled,
            metadata: {
              stripe_subscription_id: event.data.object.id,
              subscription_status: event.data.object.status
            }
          });
        }
        break;
      case "invoice.payment_failed":
        syncResult = await handleInvoicePaymentFailed(supabase, event.data.object);
        break;
      default:
        break;
    }

    const syncedWorkspaceId = syncResult.workspace?.id || syncResult.workspaceId || null;

    if (syncedWorkspaceId) {
      try {
        await recordAuditEvent(supabase, {
          workspaceId: syncedWorkspaceId,
          eventType: auditEventTypes.stripeWebhook,
          metadata: {
            stripe_event_id: event.id,
            event_type: event.type,
            synced: Boolean(syncResult.synced)
          }
        });
      } catch {
        // Billing sync must not fail just because the optional audit trail failed.
      }
    }

    await updateWebhookProcessingRecord(supabase, event.id, {
      status: "processed",
      workspace_id: syncedWorkspaceId,
      metadata: {
        event_type: event.type,
        synced: Boolean(syncResult.synced),
        reason: syncResult.reason || null
      }
    });

    return res.status(200).json({ received: true, sync: syncResult });
  } catch {
    await updateWebhookProcessingRecord(supabase, event.id, {
      status: "failed",
      metadata: {
        event_type: event.type,
        failed: true
      }
    });

    return res.status(500).json({
      message: "Stripe webhook received but subscription sync failed."
    });
  }
}
