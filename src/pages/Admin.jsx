import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function formatAdminMessage(value, fallback = "Some admin datasets could not be loaded. Check network logs or admin API permissions.") {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.message === "string") {
    return value.message;
  }

  if (typeof value.error === "string") {
    return value.error;
  }

  return fallback;
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
  const isMountedRef = useRef(false);

  const loadAdminSummary = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    try {
      const data = await getAdminSummary();
      if (isMountedRef.current) {
        setSummary(data);
        setStatus("ready");
      }
    } catch (error) {
      if (isMountedRef.current) {
        setStatus(error.status === 401 || error.status === 403 ? "denied" : "error");
        setMessage(formatAdminMessage(error, "Admin data could not be loaded. Check network logs or admin API permissions."));
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadAdminSummary();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadAdminSummary]);

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
      <AppShell title="Platform Infrastructure" eyebrow="Admin">
        <div className="loadingState">Loading platform controls...</div>
      </AppShell>
    );
  }

  if (status === "denied") {
    return (
      <AppShell title="Access denied" eyebrow="Admin">
        <div className="emptyState">
          <strong>Access denied</strong>
          <p>{message || "This area is limited to KtrlAI platform administrators."}</p>
        </div>
      </AppShell>
    );
  }

  if (status === "error") {
    return (
      <AppShell title="Platform Infrastructure unavailable" eyebrow="Admin">
        <div className="emptyState">
          <strong>Admin controls could not be loaded</strong>
          <p>{message}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={loadAdminSummary}>
              Retry admin data
            </button>
          </div>
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
  const security = summary.security || {};
  const rateLimiting = security.rateLimiting || {};
  const notifications = summary.notifications || {};
  const jobs = summary.jobs || {};
  const rollups = platformAnalytics.rollups || {};
  const environmentReadyCount = Object.values(requiredEnv).filter(Boolean).length;
  const environmentTotalCount = Math.max(Object.keys(requiredEnv).length, 1);
  const failedJobCount = jobs.failedJobs?.length || jobs.failed || 0;

  return (
      <AppShell
        title="Platform Infrastructure"
        eyebrow="Admin"
        subtitle="Operator-only view for platform health, datasets, queues, abuse controls, jobs, security, and growth."
      >
      <section className="commandHero adminCommandHero" aria-label="Platform operations command summary">
        <div className="commandHeroCopy">
          <span className="eyebrow">Platform operations center</span>
          <h2>KtrlAI infrastructure operations</h2>
          <p>Monitor ingestion, queue health, rate limits, rollups, billing state, audit activity, and workspace risk.</p>
        </div>
        <div className="commandHeroMetrics">
          <article>
            <span>Events ingested</span>
            <strong>{summary.overview?.eventsIngested || 0}</strong>
            <em>All time</em>
          </article>
          <article>
            <span>Queue health</span>
            <strong>{failedJobCount ? "Attention" : "Ready"}</strong>
            <em>{failedJobCount} failed jobs</em>
          </article>
          <article>
            <span>Environment</span>
            <strong>{environmentReadyCount}/{environmentTotalCount}</strong>
            <em>Required vars ready</em>
          </article>
          <article>
            <span>Security</span>
            <strong>{(security.suspiciousWorkspaces || []).length}</strong>
            <em>Workspace signals</em>
          </article>
        </div>
      </section>

      <section className="metricGrid adminMetricGrid">
        {overviewCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      {summary.warnings?.length ? (
        <section className="domainVerificationMessage error adminWarning" role="status">
          Some admin datasets could not be loaded.{" "}
          {summary.warnings.slice(0, 3).map((warning) => formatAdminMessage(warning, "")).filter(Boolean).join(" | ") ||
            "Check network logs or admin API permissions."}
        </section>
      ) : null}

      <section className="dashboardGrid adminSecurityGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Security</span>
              <h2>Suspicious workspace signals</h2>
            </div>
          </div>
          <div className="adminAuditList">
            {(security.suspiciousWorkspaces || []).length === 0 ? (
              <p>No recent suspicious crawler activity.</p>
            ) : (
              security.suspiciousWorkspaces.map((workspace) => (
                <div key={workspace.workspaceId}>
                  <span>{workspace.workspaceName}</span>
                  <strong>{workspace.suspiciousCount}</strong>
                  <em>Suspicious events</em>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Abuse protection</span>
              <h2>Rate-limit triggers</h2>
            </div>
            <StatusBadge status={rateLimiting.provider === "upstash" ? "Redis shared" : "Memory fallback"} />
          </div>
          <div className="adminPlanGrid">
            <article>
              <span>Provider</span>
              <strong>{rateLimiting.provider || health.rateLimitProvider || "memory"}</strong>
            </article>
            <article>
              <span>Redis</span>
              <strong>{rateLimiting.redisConfigured ? "Configured" : "Not configured"}</strong>
            </article>
            <article>
              <span>Algorithm</span>
              <strong>{rateLimiting.algorithm || "fixed-window"}</strong>
            </article>
          </div>
          <div className="adminAuditList">
            <h3>Recent triggers</h3>
            {(security.rateLimitTriggers || []).length === 0 ? (
              <p>No rate-limit triggers recorded.</p>
            ) : (
              security.rateLimitTriggers.slice(0, 8).map((event) => (
                <div key={event.id}>
                  <span>{event.workspaceName}</span>
                  <strong>{statusLabel(event.scope)}</strong>
                  <em>{event.provider || "memory"} - {formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Abuse counters</h3>
            {(rateLimiting.abuseCounters || []).length === 0 ? (
              <p>No abuse counters recorded.</p>
            ) : (
              rateLimiting.abuseCounters.slice(0, 6).map((counter) => (
                <div key={counter.id}>
                  <span>{counter.workspaceName}</span>
                  <strong>{statusLabel(counter.scope)} - {counter.count}</strong>
                  <em>{counter.provider || "memory"} - {formatDateTime(counter.updatedAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Top limited scopes</h3>
            {(rateLimiting.topScopes || []).length === 0 ? (
              <p>No limited scopes yet.</p>
            ) : (
              rateLimiting.topScopes.slice(0, 5).map((scope) => (
                <div key={scope.scope}>
                  <span>{statusLabel(scope.scope)}</span>
                  <strong>{scope.count}</strong>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="panel largePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Audit</span>
              <h2>Recent security activity</h2>
            </div>
          </div>
          <div className="adminAuditList">
            {(security.auditActivityFeed || []).length === 0 ? (
              <p>No enterprise audit activity recorded yet.</p>
            ) : (
              security.auditActivityFeed.slice(0, 10).map((event) => (
                <div key={event.id}>
                  <span>{event.eventSummary}</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{event.actor} - {formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Growth</span>
              <h2>Workspace/user growth</h2>
            </div>
          </div>
          <div className="adminPlanGrid">
            <article>
              <span>New users 7d</span>
              <strong>{security.growth?.usersLast7Days || 0}</strong>
            </article>
            <article>
              <span>New workspaces 7d</span>
              <strong>{security.growth?.workspacesLast7Days || 0}</strong>
            </article>
          </div>
        </article>
      </section>

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
            <article>
              <span>AI bot events</span>
              <strong>{platformAnalytics.aiBotEvents || 0}</strong>
            </article>
            <article>
              <span>Suspicious events</span>
              <strong>{platformAnalytics.suspiciousEvents || 0}</strong>
            </article>
            <article>
              <span>Unknown crawlers</span>
              <strong>{platformAnalytics.unknownCrawlerEvents || 0}</strong>
            </article>
            <article>
              <span>Rollup status</span>
              <strong>{statusLabel(rollups.lastRunStatus || "not run")}</strong>
            </article>
            <article>
              <span>Pending rollups</span>
              <strong>{rollups.pendingJobs || 0}</strong>
            </article>
          </div>
          <div className="adminAuditList">
            <h3>Rollup health</h3>
            <div>
              <span>Coverage</span>
              <strong>{rollups.coverageStart && rollups.coverageEnd ? `${rollups.coverageStart} to ${rollups.coverageEnd}` : "No coverage yet"}</strong>
            </div>
            <div>
              <span>Last successful run</span>
              <strong>{formatDateTime(rollups.lastSuccessfulRunAt)}</strong>
              <em>{rollups.lastProcessedEvents || 0} events across {rollups.lastProcessedDays || 0} day buckets</em>
            </div>
            <div>
              <span>Failed runs</span>
              <strong>{rollups.failedRuns || 0}</strong>
            </div>
          </div>
          <div className="adminAuditList">
            <h3>Top detected AI crawlers</h3>
            {(platformAnalytics.topAiCrawlers || []).length === 0 ? (
              <p>No AI crawler detections in the last 7 days.</p>
            ) : (
              platformAnalytics.topAiCrawlers.map((bot) => (
                <div key={bot.botName}>
                  <span>{bot.botName}</span>
                  <strong>{bot.count}</strong>
                </div>
              ))
            )}
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
                  <em>{statusLabel(event.status)} - {formatDateTime(event.createdAt)}</em>
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

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Notifications</span>
              <h2>Email delivery</h2>
            </div>
            <StatusBadge status={notifications.providerConfigured ? "Configured" : "Not configured"} />
          </div>
          <div className="adminPlanGrid">
            <article>
              <span>Provider</span>
              <strong>{notifications.provider || "noop"}</strong>
            </article>
            <article>
              <span>Failed notifications</span>
              <strong>{notifications.failedCount || 0}</strong>
            </article>
            <article>
              <span>Last sent</span>
              <strong>{formatDateTime(notifications.lastSentNotification)}</strong>
            </article>
          </div>
          <div className="adminAuditList">
            <h3>Recent notification events</h3>
            {(notifications.recentEvents || []).length === 0 ? (
              <p>No notification events recorded yet.</p>
            ) : (
              notifications.recentEvents.slice(0, 8).map((event) => (
                <div key={event.id}>
                  <span>{statusLabel(event.type)}</span>
                  <strong>{event.workspaceName}</strong>
                  <em>{statusLabel(event.status)} - {formatDateTime(event.createdAt)}</em>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Queue</span>
              <h2>Background jobs</h2>
            </div>
            <StatusBadge status={jobs.runnerSecretConfigured ? "Protected" : "Needs secret"} />
          </div>
          <div className="adminPlanGrid">
            <article>
              <span>Queued</span>
              <strong>{jobs.counts?.queued || 0}</strong>
            </article>
            <article>
              <span>Processing</span>
              <strong>{jobs.counts?.processing || 0}</strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>{jobs.counts?.completed || 0}</strong>
            </article>
            <article>
              <span>Failed</span>
              <strong>{jobs.counts?.failed || 0}</strong>
            </article>
          </div>
          <div className="adminAuditList">
            <h3>Recent job failures</h3>
            {(jobs.recentFailures || []).length === 0 ? (
              <p>No failed jobs recorded.</p>
            ) : (
              jobs.recentFailures.slice(0, 6).map((job) => (
                <div key={job.id}>
                  <span>{statusLabel(job.type)}</span>
                  <strong>{job.attempts}/{job.maxAttempts} attempts</strong>
                  <em>{formatDateTime(job.failedAt)}</em>
                </div>
              ))
            )}
          </div>
          <div className="adminAuditList">
            <h3>Recent jobs</h3>
            {(jobs.recentJobs || []).length === 0 ? (
              <p>No queued jobs yet.</p>
            ) : (
              jobs.recentJobs.slice(0, 6).map((job) => (
                <div key={job.id}>
                  <span>{statusLabel(job.type)}</span>
                  <strong>{statusLabel(job.status)}</strong>
                  <em>{job.attempts}/{job.maxAttempts} attempts</em>
                </div>
              ))
            )}
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
            <HealthItem label="Email provider" enabled={health.emailProviderConfigured} detail={health.emailProvider || "noop"} />
            <HealthItem label="Job runner" enabled={health.jobRunnerConfigured} detail={health.queueStatus || "Queue"} />
            <HealthItem label="Tracker endpoint" enabled={health.trackerEndpointStatus === "Ready"} detail={health.trackerEndpointStatus} />
            <HealthItem label="Health endpoint" enabled={Boolean(health.healthEndpointStatus)} detail={health.healthEndpointStatus} />
            <HealthItem
              label="Analytics rollups"
              enabled={Boolean(health.analyticsRollupsConfigured)}
              detail={health.analyticsRollupCoverage || "Rollup tables"}
              statusText={statusLabel(health.analyticsRollupStatus || "unknown")}
            />
            <HealthItem
              label="Rate limits"
              enabled={Boolean(health.rateLimitStore)}
              detail={health.rateLimitStore}
              statusText={health.rateLimitProvider === "upstash" ? "Redis shared" : "Memory fallback"}
            />
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
