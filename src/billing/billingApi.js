import { checkoutEndpoint, isPaidPlan } from "./stripeConfig.js";
import { getSupabaseAccessToken } from "../lib/supabaseClient.js";
import { allowLocalMockFallback, isProductionApp } from "../config/runtime.js";

export const BILLING_CHECKOUT_DISABLED_MESSAGE =
  "Billing is not configured yet. Add Stripe keys and plan price IDs before checkout can start.";

export const BILLING_PORTAL_DISABLED_MESSAGE =
  "Billing portal is available after subscription setup.";

function getBrowserOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function startBillingCheckout({ planKey, user, workspaceId } = {}) {
  if (!isPaidPlan(planKey)) {
    return {
      ok: true,
      status: "free",
      message: "Free plan selected."
    };
  }

  const origin = getBrowserOrigin();

  try {
    const accessToken = await getSupabaseAccessToken();

    if (isProductionApp && (!accessToken || !workspaceId)) {
      return {
        ok: false,
        status: "auth_required",
        message: "Log in and select a workspace before choosing a paid plan."
      };
    }

    const response = await fetch(checkoutEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({
        plan: planKey,
        workspaceId: workspaceId || "demo",
        customerEmail: user?.email || "",
        successUrl: origin ? `${origin}/dashboard?checkout=success` : undefined,
        cancelUrl: origin ? `${origin}/#pricing` : undefined
      })
    });

    const data = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: "setup_required",
        message: data.message || BILLING_CHECKOUT_DISABLED_MESSAGE
      };
    }

    if (data.url && typeof window !== "undefined") {
      window.location.assign(data.url);
      return {
        ok: true,
        status: "redirecting",
        message: "Redirecting to Stripe Checkout..."
      };
    }

    return {
      ok: false,
      status: "setup_required",
      message: data.message || BILLING_CHECKOUT_DISABLED_MESSAGE
    };
  } catch (error) {
    return {
      ok: false,
      status: allowLocalMockFallback ? "local_unavailable" : "backend_unavailable",
      message: error.message || BILLING_CHECKOUT_DISABLED_MESSAGE
    };
  }
}

export async function openBillingPortal() {
  return {
    ok: false,
    status: "setup_required",
    message: BILLING_PORTAL_DISABLED_MESSAGE
  };
}

export async function requestPayoutReview({ amountCents, currency = "USD", workspaceId } = {}) {
  if (!workspaceId) {
    const error = new Error("A workspace is required before requesting a payout.");
    error.useMockFallback = allowLocalMockFallback;
    throw error;
  }

  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    const error = new Error("Sign in again before requesting a payout.");
    error.useMockFallback = allowLocalMockFallback;
    throw error;
  }

  const response = await fetch("/api/request-payout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      amount_cents: amountCents,
      currency
    })
  });

  const data = await safeJson(response);

  if (!response.ok) {
    const error = new Error(data.message || "Payout request could not be submitted.");
    error.useMockFallback = allowLocalMockFallback && response.status >= 500;
    throw error;
  }

  return {
    id: data.request?.id || `payout_${Date.now()}`,
    amountCents: data.request?.amount_cents ?? data.request?.amountCents ?? amountCents,
    currency: data.request?.currency || currency,
    status: data.request?.status || "requested",
    createdAt: data.request?.created_at || data.request?.createdAt || new Date().toISOString()
  };
}
