// Frontend-safe Stripe billing configuration.
// Only VITE_ variables are exposed to the browser. Keep Stripe secret keys and
// price IDs inside serverless functions or backend environment variables.

const viteEnv = import.meta.env || {};

export const stripePublishableKey = viteEnv.VITE_STRIPE_PUBLISHABLE_KEY || "";

export const checkoutEndpoint = "/api/create-checkout-session";

export const billingPlans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "/mo",
    description: "For checking visibility and validating early AI traffic.",
    bullets: ["1 domain", "Visibility scan", "Basic AI activity log"],
    highlighted: false
  },
  {
    key: "pro",
    name: "Pro",
    price: "$49",
    cadence: "/mo",
    description: "For creators and teams that need control.",
    bullets: ["5 domains", "Control center", "Training permissions", "Revenue estimates"],
    highlighted: true
  },
  {
    key: "business",
    name: "Business",
    price: "$249",
    cadence: "/mo",
    description: "For publishers, platforms, and data owners.",
    bullets: ["Unlimited domains", "Paid AI access", "Dataset licensing", "Priority governance support"],
    highlighted: false
  }
];

export function normalizePlan(plan) {
  return String(plan || "Free").trim().toLowerCase();
}

export function isPaidPlan(planKey) {
  return planKey === "pro" || planKey === "business";
}
