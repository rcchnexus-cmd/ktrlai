export function buildStripeConnectPayoutPlan({ workspaceId, payoutRequestId, amountCents, currency }) {
  // Future Stripe Connect integration point:
  // - Verify workspace has an onboarded Stripe connected account.
  // - Confirm earnings_ledger rows are eligible and not already paid.
  // - Create a Stripe transfer or payout from a server-only API function.
  // - Store Stripe transfer/payout IDs in payout_requests or a dedicated payouts table.
  // This helper intentionally does not move money or collect bank details.
  return {
    workspaceId,
    payoutRequestId,
    amountCents,
    currency,
    provider: "stripe_connect",
    live: false
  };
}
