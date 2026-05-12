// Frontend-safe Stripe billing configuration.
// Only VITE_ variables are exposed to the browser. Keep Stripe secret keys and
// price IDs inside serverless functions or backend environment variables.

const viteEnv = import.meta.env || {};

export const stripePublishableKey = viteEnv.VITE_STRIPE_PUBLISHABLE_KEY || "";

export const checkoutEndpoint = "/api/billing?action=checkout";

export const billingPlans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "/mo",
    description: "For checking visibility and validating early AI traffic.",
    bullets: ["1 domain", "1 API key", "1,000 events/month"],
    highlighted: false
  },
  {
    key: "pro",
    name: "Pro",
    price: "$49",
    cadence: "/mo",
    description: "For creators and teams that need control.",
    bullets: ["10 domains", "10 API keys", "100,000 events/month", "Control center"],
    highlighted: true
  },
  {
    key: "business",
    name: "Business",
    price: "$249",
    cadence: "/mo",
    description: "For publishers, platforms, and data owners.",
    bullets: ["High-volume domains", "High-volume API keys", "10M events/month", "Priority governance support"],
    highlighted: false
  }
];

export function normalizePlan(plan) {
  return String(plan || "Free").trim().toLowerCase();
}

export function isPaidPlan(planKey) {
  return planKey === "pro" || planKey === "business";
}
