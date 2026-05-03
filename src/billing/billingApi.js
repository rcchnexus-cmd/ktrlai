import { checkoutEndpoint, isPaidPlan } from "./stripeConfig.js";
import { getSupabaseAccessToken } from "../lib/supabaseClient.js";

export const BILLING_CHECKOUT_DISABLED_MESSAGE =
  "Billing checkout will be enabled after backend deployment.";

export const BILLING_PORTAL_DISABLED_MESSAGE =
  "Billing portal will be enabled after backend deployment.";

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
      message: "Free plan selected. Your mock workspace remains on the Free plan."
    };
  }

  const origin = getBrowserOrigin();

  try {
    const accessToken = await getSupabaseAccessToken();
    const response = await fetch(checkoutEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({
        plan: planKey,
        workspaceId: workspaceId || "mock_workspace",
        customerEmail: user?.email || "",
        successUrl: origin ? `${origin}/dashboard?checkout=success` : undefined,
        cancelUrl: origin ? `${origin}/#pricing` : undefined
      })
    });

    const data = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: "mock",
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
      status: "mock",
      message: data.message || BILLING_CHECKOUT_DISABLED_MESSAGE
    };
  } catch {
    return {
      ok: false,
      status: "mock",
      message: BILLING_CHECKOUT_DISABLED_MESSAGE
    };
  }
}

export async function openBillingPortal() {
  return {
    ok: false,
    status: "mock",
    message: BILLING_PORTAL_DISABLED_MESSAGE
  };
}
