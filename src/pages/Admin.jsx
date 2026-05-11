import { useEffect, useMemo, useState } from "react";
import { getAdminSummary } from "../admin/adminApi.js";
import AppShell from "../components/AppShell.jsx";
import MetricCard from "../components/MetricCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMoney(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format((cents || 0) / 100);
}

function statusLabel(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function HealthItem({ label, enabled, detail, statusText }) {
  return (
    <article className={enabled ? "adminHealthItem ready" : "adminHealthItem attention"}>
      <span>{label}</span>
      <strong>{statusText || (enabled ? "Ready" : "Needs setup")}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

export default function Admin() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    setStatus("loading");
    setMessage("");

    getAdminSummary()
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStatus(error.status === 401 || error.status === 403 ? "denied" : "error");
          setMessage(error.message || "Admin data could not be loaded.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const overviewCards = useMemo(() => {
    const overview = summary?.overview || {};
    const platformAnalytics = summary?.platformAnalytics || {};

    return [
      { label: "Total users", value: overview.totalUsers || 0, change: "Profiles", tone: "neutral" },
      { label: "Workspaces", value: overview.totalWorkspaces || 0, change: "Active accounts", tone: "neutral" },
      { label: "Domains", value: overview.totalDomains || 0, change: `${overview.verifiedDomains || 0} verified`, tone: "positive" },
      { label: "Active API keys", value: overview.activeApiKeys || 0, change: "Unrevoked", tone: "neutral" },
      { label: "Events ingested", value: overview.eventsIngested || 0, change: "All time", tone: "positive" },
      {
        label: "Events 7d",
        value: platformAnalytics.eventsLast7Days || 0,
        change: `${platformAnalytics.eventGrowthPercent || 0}% vs prior`,
        tone: (platformAnalytics.eventGrowthPercent || 0) >= 0 ? "positive" : "negative"
      },
      {
        label: "Active event workspaces",
        value: platformAnalytics.activeWorkspacesWithEvents || 0,
        change: "Last 7 days",
        tone: "neutral"
      },
      { label: "Estimated revenue", value: formatMoney(overview.estimatedRevenueCents), change: "Confirmed ledger", tone: "positive" },
      { label: "Payout requests", value: overview.payoutRequests || 0, change: "Review queue", tone: "neutral" },
      { label: "Verified domains", value: overview.verifiedDomains || 0, change: "DNS confirmed", tone: "positive" }
    ];
  }, [summary]);

  if (status === "loading") {
    return (
      <AppShell title="Admin" eyebrow="Platform Admin">
        <div className="loadingState">Loading platform controls...</div>
      </AppShell>
    );
  }

  if (status === "denied") {
    return (
      <AppShell title="Access denied" eyebrow="Platform Admin">
        <div className="emptyState">
          <strong>Access denied</strong>
          <p>{message || "This area is limited to KtrlAI platform administrators."}</p>
        </div>
      </AppShell>
    );
  }

  if (status === "error") {
    return (
      <AppShell title="Admin unavailable" eyebrow="Platform Admin">
        <div className="emptyState">
          <strong>Admin controls could not be loaded</strong>
          <p>{message}</p>
        </div>
      </AppShell>
    );
  }

  const health = summary.systemHealth || {};
  const requiredEnv = health.requiredEnv || {};
  const billing = summary.billing || {};
  const users = summary.users || [];
  const workspaces = summary.workspaces || [];
  const activity = summary.activity || [];
  const domains = summary.domains || [];
  const payouts = summary.payouts || [];
  const platformAnalytics = summary.platformAnalytics || {};

  return (
    <AppShell title="Admin" eyebrow="Platform Admin">
      <section className="adminHero panel">
        <div>
          <span className="eyebrow">Internal Control System</span>
          <h2>KtrlAI platform operations</h2>
          <p>Monitor users, workspaces, ingestion, billing readiness, and payout review state from a separate operator-only surface.</p>
        </div>
        <StatusBadge status={health.payoutsEnabled ? "Payouts enabled" : "Payouts disabled"} />
      </section>

      <section className="metricGrid adminMetricGrid">
        {overviewCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      {summary.warnings?.length ? (
        <section className="domainVerificationMessage error adminWarning" role="status">
          Some admin datasets could not be loaded: {summary.warnings.slice(0, 3).join(" | ")}
        </section>
      ) : null}

      <section className="dashboardGrid adminGrid">
        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Users</span>
              <h2>User management</h2>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Plan</th>
                  <th>Workspaces</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>{user.plan}</td>
                    <td>{user.workspaceCount}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Workspaces</span>
              <h2>Workspace monitoring</h2>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Domains</th>
                  <th>Keys</th>
                  <th>Events</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>{workspace.name}</td>
                    <td>{workspace.ownerEmail || workspace.ownerName}</td>
                    <td>{workspace.plan}</td>
                    <td>{workspace.domainsCount}</td>
                    <td>{workspace.apiKeysCount}</td>
                    <td>{workspace.eventsCount}</td>
                    <td>{formatDate(workspace.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Activity</span>
              <h2>Recent ingestion</h2>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Page</th>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((event) => (
                  <tr key={event.id}>
                    <td>{event.botType}</td>
                    <td>{event.page}</td>
                    <td>{event.workspaceName}</td>
                    <td><StatusBadge status={statusLabel(event.status)} /></td>
                    <td>{formatDateTime(event.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Domains</span>
              <h2>Domain monitoring</h2>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Workspace</th>
                  <th>Last checked</th>
                  <th>Token</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td>{domain.hostname}</td>
                    <td><StatusBadge status={statusLabel(domain.status)} /></td>
                    <td>{domain.workspaceName}</td>
                    <td>{formatDateTime(domain.lastCheckedAt)}</td>
                    <td>Hidden</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="adminSectionGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Analytics</span>
              <h2>Platform ingestion</h2>
            </div>
          </div>
          <div className="adminPlanGrid">
            <article>
              <span>Events last 7 days</span>
              <strong>{platformAnalytics.eventsLast7Days || 0}</strong>
            </article>
            <article>
              <span>Active workspaces</span>
              <strong>{platformAnalytics.activeWorkspacesWithEvents || 0}</strong>
            </article>
          </div>
          <div className="adminAuditList">
            <h3>Top bot types</h3>
            {(platformAnalytics.topBotTypes || []).length === 0 ? (
              <p>No ingestion events in the last 7 days.</p>
            ) : (
              platformAnalytics.topBotTypes.map((bot) => (
                <div key={bot.botType}>
                  <span>{bot.botType}</span>
                  <strong>{bot.count}</strong>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Recent ingestion events</h3>
            {(platformAnalytics.recentIngestionEvents || []).length === 0 ? (
              <p>No recent ingestion events.</p>
            ) : (
              platformAnalytics.recentIngestionEvents.slice(0, 6).map((event) => (
                <div key={event.id}>
                  <span>{event.botType}</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{formatDateTime(event.timestamp)}</em>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Billing</span>
              <h2>Billing overview</h2>
            </div>
          </div>
          <div className="adminPlanGrid">
            {Object.entries(billing.planCounts || {}).map(([plan, count]) => (
              <article key={plan}>
                <span>{plan}</span>
                <strong>{count}</strong>
              </article>
            ))}
          </div>
          <div className="adminList">
            {Object.entries(billing.subscriptionStatuses || {}).map(([subscriptionStatus, count]) => (
              <div key={subscriptionStatus}>
                <span>{statusLabel(subscriptionStatus)}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="adminAuditList">
            <h3>Stripe IDs</h3>
            <div className="tableWrap compactTableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Customer</th>
                    <th>Subscription</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.slice(0, 8).map((workspace) => (
                    <tr key={workspace.id}>
                      <td>{workspace.name}</td>
                      <td>{workspace.stripeCustomerId || "Not linked"}</td>
                      <td>{workspace.stripeSubscriptionId || "Not linked"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="adminAuditList">
            <h3>Recent billing audit events</h3>
            {(billing.auditEvents || []).length === 0 ? (
              <p>No billing audit events yet.</p>
            ) : (
              billing.auditEvents.map((event) => (
                <div key={event.id}>
                  <span>{statusLabel(event.eventType)}</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Recent Stripe webhook events</h3>
            {(billing.recentBillingEvents || []).length === 0 ? (
              <p>No Stripe webhook events processed yet.</p>
            ) : (
              billing.recentBillingEvents.slice(0, 8).map((event) => (
                <div key={event.id}>
                  <span>{statusLabel(event.eventType)}</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{statusLabel(event.status)} · {formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Failed payments</h3>
            {(billing.failedPayments || []).length === 0 ? (
              <p>No recent failed payments.</p>
            ) : (
              billing.failedPayments.slice(0, 5).map((event) => (
                <div key={event.id}>
                  <span>Invoice payment failed</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Cancellations</h3>
            {(billing.cancellations || []).length === 0 ? (
              <p>No recent subscription cancellations.</p>
            ) : (
              billing.cancellations.slice(0, 5).map((event) => (
                <div key={event.id}>
                  <span>Subscription canceled</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Payouts</span>
              <h2>Payout review</h2>
            </div>
          </div>
          <p className="payoutNotice">Payout execution is disabled. This queue is read-only until backend payout approvals are explicitly enabled.</p>
          <div className="tableWrap compactTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((request) => (
                  <tr key={request.id}>
                    <td>{request.workspaceName}</td>
                    <td>{formatMoney(request.amountCents, request.currency)}</td>
                    <td><StatusBadge status={statusLabel(request.status)} /></td>
                    <td>{formatDate(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">System</span>
              <h2>System health</h2>
            </div>
          </div>
          <div className="adminHealthGrid">
            <HealthItem label="Supabase" enabled={health.supabaseConnected} detail="Server admin client" />
            <HealthItem label="Stripe checkout" enabled={health.stripeConfigPresent} detail="Secret and price IDs" />
            <HealthItem label="Stripe webhook" enabled={health.stripeWebhookConfigured} detail="Signature verification" />
            <HealthItem label="Tracker endpoint" enabled={health.trackerEndpointStatus === "Ready"} detail={health.trackerEndpointStatus} />
            <HealthItem
              label="Payouts"
              enabled={health.payoutsEnabled}
              statusText={health.payoutsEnabled ? "Enabled" : "Disabled"}
              detail={health.payoutsEnabled ? "Enabled" : "Disabled by default"}
            />
          </div>
          <div className="adminEnvGrid">
            {Object.entries(requiredEnv).map(([key, present]) => (
              <div key={key}>
                <span>{key}</span>
                <StatusBadge status={present ? "Ready" : "Missing"} />
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
