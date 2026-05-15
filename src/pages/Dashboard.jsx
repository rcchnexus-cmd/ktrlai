import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import MetricCard from "../components/MetricCard.jsx";
import SetupGuide from "../components/SetupGuide.jsx";
import { DistributionChart, TrafficChart } from "../components/Charts.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

function formatInstallDate(value) {
  if (!value) {
    return "No events yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getInstallStatusLabel(status) {
  const labels = {
    not_installed: "Not installed",
    pending: "Waiting for first event",
    active: "Tracker active",
    inactive: "Inactive"
  };

  return labels[status] || "Waiting for first event";
}

export default function Dashboard() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.dashboard && !state.loading.dashboard && !state.errors.dashboard) {
      actions.loadDashboard();
    }
  }, [actions, state.dashboard, state.errors.dashboard, state.loading.dashboard]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !state.dashboard) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        actions.loadDashboard();
      }
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [actions, state.auth.isAuthenticated, state.dashboard]);

  useEffect(() => {
    if (state.auth.isAuthenticated && !state.settings && !state.loading.settings) {
      actions.loadSettings();
    }
  }, [actions, state.auth.isAuthenticated, state.loading.settings, state.settings]);

  const dashboard = state.dashboard;
  const dashboardError = state.errors.dashboard;
  const storedApiKey = state.settings?.apiKey || {};
  const hasStoredApiKey = Boolean(storedApiKey.id || storedApiKey.keyPrefix || storedApiKey.key);
  const shouldShowOnboarding = Boolean(state.settings && dashboard);
  const dataLabel = dashboard?.sourceLabel || "Awaiting tracking data";
  const dataDetail = dashboard?.sourceDetail || "Install your tracker to start seeing live AI access analytics.";
  const hasWorkspaceApiKey = hasStoredApiKey;
  const verifiedDomainCount = (state.settings?.domains || []).filter(
    (item) => String(item.status || "").toLowerCase() === "verified"
  ).length;
  const rawInstallHealth = dashboard?.installHealth || {
    status: "not_installed",
    sdkInstalled: false,
    lastEventAt: null,
    eventsToday: 0,
    activeDomains: 0,
    trackerHealth: "Install the tracker to begin"
  };
  const installHealth = {
    ...rawInstallHealth,
    status: rawInstallHealth.status === "not_installed" && hasWorkspaceApiKey ? "pending" : rawInstallHealth.status,
    activeDomains: Math.max(Number(rawInstallHealth.activeDomains || 0), verifiedDomainCount),
    trackerHealth:
      rawInstallHealth.status === "not_installed" && hasWorkspaceApiKey
        ? "Waiting for first event"
        : rawInstallHealth.trackerHealth
  };
  const aiRequestKpi = dashboard?.kpis?.find((kpi) => /visit|request|traffic/i.test(kpi.label)) || dashboard?.kpis?.[0];
  const suspiciousInsight = dashboard?.detectionInsights?.find(
    (insight) => /suspicious|scrap/i.test(`${insight.label} ${insight.detail}`)
  );
  const topAiSystem = dashboard?.botDistribution?.[0];

  return (
    <AppShell
      title="Operations"
      eyebrow="AI traffic control plane"
      action={
        <RouteLink to="/visibility" className="primaryButton smallButton">
          Check site
        </RouteLink>
      }
    >
      {dashboardError ? (
        <div className="emptyState">
          <strong>Dashboard analytics could not be loaded</strong>
          <p>{dashboardError}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadDashboard}>
              Retry dashboard
            </button>
            <RouteLink to="/settings#install" className="primaryButton smallButton">
              Check install
            </RouteLink>
          </div>
        </div>
      ) : !dashboard ? (
        <div className="loadingState">Loading AI activity...</div>
      ) : (
        <>
          {shouldShowOnboarding && (
            <SetupGuide settings={state.settings} dashboard={dashboard} />
          )}
          <section className={`dataModeNotice ${dashboard.source || "empty"}`} aria-label="Dashboard data status">
            <StatusBadge status={dataLabel} />
            <span>{dataDetail}</span>
          </section>
          <section className="opsCommandGrid" aria-label="AI traffic operations summary">
            <article className="opsCommandCard primary">
              <span>AI request state</span>
              <strong>{aiRequestKpi?.value ?? "0"}</strong>
              <p>{aiRequestKpi?.label || "Tracked AI requests"}</p>
            </article>
            <article className="opsCommandCard">
              <span>Governance posture</span>
              <strong>{verifiedDomainCount > 0 ? "Controlled" : "Setup required"}</strong>
              <p>{verifiedDomainCount > 0 ? `${verifiedDomainCount} verified domain${verifiedDomainCount === 1 ? "" : "s"}` : "Verify a domain to enforce workspace policy."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Risk signal</span>
              <strong>{suspiciousInsight?.value ?? "0"}</strong>
              <p>{suspiciousInsight?.detail || "Suspicious crawler activity will surface here."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Top AI system</span>
              <strong>{topAiSystem?.label || "Pending"}</strong>
              <p>{topAiSystem ? `${topAiSystem.value}% of observed crawler mix` : "Awaiting enough live events."}</p>
            </article>
          </section>
          <section className="installHealthPanel panel" aria-label="Tracker installation health">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Install health</span>
                <h2>{installHealth.trackerHealth}</h2>
              </div>
              <StatusBadge status={getInstallStatusLabel(installHealth.status)} />
            </div>
            <div className="installHealthGrid compact">
              <article>
                <span>SDK installed</span>
                <strong>{installHealth.sdkInstalled ? "Detected" : "Not detected"}</strong>
              </article>
              <article>
                <span>Last event</span>
                <strong>{formatInstallDate(installHealth.lastEventAt)}</strong>
              </article>
              <article>
                <span>Events today</span>
                <strong>{installHealth.eventsToday || 0}</strong>
              </article>
              <article>
                <span>Active domains</span>
                <strong>{installHealth.activeDomains || 0}</strong>
              </article>
            </div>
          </section>
          <section className="metricGrid">
            {dashboard.kpis.map((kpi) => (
              <MetricCard key={kpi.label} {...kpi} />
            ))}
          </section>
          {dashboard.detectionInsights?.length ? (
            <section className="detectionInsightGrid" aria-label="AI bot detection intelligence">
              {dashboard.detectionInsights.map((insight) => (
                <article className={`detectionInsight ${insight.tone || "neutral"}`} key={insight.label}>
                  <span>{insight.label}</span>
                  <strong>{insight.value}</strong>
                  <em>{insight.detail}</em>
                </article>
              ))}
            </section>
          ) : null}
          <section className="dashboardGrid">
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Trend</span>
                  <h2>AI traffic over time</h2>
                </div>
                <em>7 days</em>
              </div>
              <TrafficChart data={dashboard.traffic} />
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Mix</span>
                  <h2>Bot distribution</h2>
                </div>
              </div>
              <DistributionChart data={dashboard.botDistribution} />
            </article>
          </section>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Live feed</span>
                <h2>Recent AI activity</h2>
              </div>
              <RouteLink to="/activity" className="textLink">
                View all
              </RouteLink>
            </div>
            {dashboard.recentActivity.length === 0 ? (
              <div className="emptyState">
                <strong>No recent AI activity</strong>
                <p>Install the tracker script or run a visibility check to start collecting AI access events.</p>
              </div>
            ) : (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bot</th>
                      <th>Page</th>
                      <th>Status</th>
                      <th>Tokens</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentActivity.map((row) => (
                      <tr key={row.id}>
                        <td>{row.bot}</td>
                        <td>{row.page}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>{row.tokens}</td>
                        <td>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
