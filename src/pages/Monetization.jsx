import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import MetricCard from "../components/MetricCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";

function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format((cents || 0) / 100);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default function Monetization() {
  const { state, actions } = useApp();
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState("");

  useEffect(() => {
    if (!state.monetization && !state.loading.monetization) {
      actions.loadMonetization();
    }
  }, [actions, state.loading.monetization, state.monetization]);

  const monetization = state.monetization;
  const earnings = monetization?.earnings;

  const requestPayout = async () => {
    setRequestingPayout(true);
    setPayoutMessage("");

    try {
      await actions.requestPayout({
        amountCents: earnings.availableCents,
        currency: earnings.currency
      });
      setPayoutMessage("Payout request submitted for review.");
    } catch (error) {
      setPayoutMessage(error.message || "Payout request could not be submitted.");
    } finally {
      setRequestingPayout(false);
    }
  };

  return (
    <AppShell title="Licensing Readiness" eyebrow="Govern">
      {!monetization ? (
        <div className="loadingState">Loading licensing settings...</div>
      ) : (
        <>
          <section className="metricGrid">
            <MetricCard label="Cleared revenue" value={`$${monetization.clearedRevenue.toLocaleString()}`} change="+18.2%" tone="positive" />
            <MetricCard label="Pending revenue" value={`$${monetization.pendingRevenue.toLocaleString()}`} change="In review" tone="neutral" />
            <MetricCard label="Estimated earnings" value={`$${monetization.projectedMonthly.toLocaleString()}`} change="Next 30 days" tone="positive" />
          </section>
          <section className="panel largePanel earningsPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Earnings ledger</span>
                <h2>Content access earnings</h2>
              </div>
              <button
                type="button"
                className="primaryButton smallButton"
                onClick={requestPayout}
                disabled={requestingPayout || !earnings.availableCents}
              >
                {requestingPayout ? "Requesting..." : "Request payout"}
              </button>
            </div>
            <div className="earningsSummary">
              <article>
                <span>Pending earnings</span>
                <strong>{formatMoney(earnings.pendingCents, earnings.currency)}</strong>
              </article>
              <article>
                <span>Confirmed earnings</span>
                <strong>{formatMoney(earnings.confirmedCents, earnings.currency)}</strong>
              </article>
              <article>
                <span>Available balance</span>
                <strong>{formatMoney(earnings.availableCents, earnings.currency)}</strong>
              </article>
            </div>
            <p className="payoutNotice">Payouts are reviewed before processing.</p>
            {payoutMessage && (
              <p className="domainVerificationMessage" role="status">
                {payoutMessage}
              </p>
            )}
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {monetization.ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.source}</td>
                      <td>{formatMoney(entry.amountCents, entry.currency)}</td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td>{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="payoutRequestList">
              <h3>Payout requests</h3>
              {monetization.payoutRequests.map((request) => (
                <article key={request.id}>
                  <div>
                    <strong>{formatMoney(request.amountCents, request.currency)}</strong>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                  <StatusBadge status={request.status.replace("_", " ")} />
                </article>
              ))}
            </div>
          </section>
          <section className="dashboardGrid">
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Paid access</span>
                  <h2>Revenue controls</h2>
                </div>
              </div>
              <label className="toggleRow">
                <div>
                  <strong>Enable paid AI access</strong>
                  <span>Require commercial terms for approved crawlers and dataset usage.</span>
                </div>
                <input
                  type="checkbox"
                  checked={monetization.paidAccess}
                  onChange={(event) => actions.updateMonetization({ paidAccess: event.target.checked })}
                />
              </label>
              <div className="priceControls">
                <label>
                  Charge per crawl
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monetization.pricePerCrawl}
                    onChange={(event) => actions.updateMonetization({ pricePerCrawl: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Charge per dataset usage
                  <input
                    type="number"
                    min="0"
                    value={monetization.pricePerDataset}
                    onChange={(event) => actions.updateMonetization({ pricePerDataset: Number(event.target.value) })}
                  />
                </label>
              </div>
            </article>
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Deals</span>
                  <h2>Revenue dashboard</h2>
                </div>
              </div>
              {monetization.deals.length === 0 ? (
                <div className="emptyState">
                  <strong>No monetization deals yet</strong>
                  <p>Enable paid AI access to start modeling crawl, summary, and dataset revenue.</p>
                </div>
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Model</th>
                        <th>Revenue</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monetization.deals.map((deal) => (
                        <tr key={deal.partner}>
                          <td>{deal.partner}</td>
                          <td>{deal.model}</td>
                          <td>{deal.revenue}</td>
                          <td>
                            <StatusBadge status={deal.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
