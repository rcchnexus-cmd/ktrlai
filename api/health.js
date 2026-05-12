import { isApiKeyHashingConfigured } from "./_crypto.js";
import { isProductionRuntime } from "./_runtime.js";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./_supabaseAdmin.js";

function withTimeout(promise, ms = 1500) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, message: "Health probe timed out." }), ms);
    })
  ]);
}

async function checkSupabase() {
  if (!isSupabaseAdminConfigured()) {
    return {
      configured: false,
      reachable: false,
      message: "Supabase server env vars are not configured."
    };
  }

  const supabase = getSupabaseAdmin();
  const result = await withTimeout(
    supabase.from("workspaces").select("id", { count: "exact", head: true }).limit(1)
  );

  if (result.error || result.ok === false) {
    return {
      configured: true,
      reachable: false,
      message: result.message || "Supabase health probe failed."
    };
  }

  return {
    configured: true,
    reachable: true,
    message: "Supabase reachable."
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(204).end();
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const supabase = await checkSupabase();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_BUSINESS_PRICE_ID);
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const hashingConfigured = isApiKeyHashingConfigured();
  const status = supabase.reachable && hashingConfigured ? "ok" : "degraded";
  const payload = {
    ok: status === "ok",
    status,
    generatedAt: new Date().toISOString(),
    runtime: {
      production: isProductionRuntime(),
      vercelEnv: process.env.VERCEL_ENV || "local"
    },
    services: {
      supabase,
      stripe: {
        configured: stripeConfigured,
        webhookConfigured,
        message: stripeConfigured ? "Stripe checkout configured." : "Stripe checkout env vars are not fully configured."
      },
      tracker: {
        configured: supabase.reachable && hashingConfigured,
        endpoint: "/api/track",
        message: hashingConfigured ? "Tracker validation configured." : "API key hashing secret is missing."
      },
      analytics: {
        configured: supabase.reachable,
        endpoint: "/api/analytics/summary"
      },
      payouts: {
        enabled: process.env.PAYOUT_REQUESTS_ENABLED === "true"
      }
    }
  };

  if (req.method === "HEAD") {
    return res.status(status === "ok" ? 200 : 503).end();
  }

  return res.status(status === "ok" ? 200 : 503).json(payload);
}
