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
  const governedShare = dashboard?.kpis?.find((kpi) => /page|govern|access/i.test(kpi.label));

  return (
    <AppShell
      title="AI Operations Center"
      eyebrow="Monitor"
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
          <section className="opsStatusRail" aria-label="Workspace infrastructure status">
            <article>
              <span>Workspace</span>
              <strong>{state.auth.workspace?.name || "Demo Workspace"}</strong>
              <em>{state.auth.user?.plan || "Free"} plan</em>
            </article>
            <article>
              <span>Tracker</span>
              <strong>{getInstallStatusLabel(installHealth.status)}</strong>
              <em>{installHealth.sdkInstalled ? "SDK detected" : "Awaiting SDK"}</em>
            </article>
            <article>
              <span>Last event</span>
              <strong>{formatInstallDate(installHealth.lastEventAt)}</strong>
              <em>{installHealth.eventsToday || 0} today</em>
            </article>
            <article>
              <span>Governance</span>
              <strong>{verifiedDomainCount > 0 ? "Ready" : "Needs domain"}</strong>
              <em>{verifiedDomainCount || 0} verified domains</em>
            </article>
            <article>
              <span>Rollups</span>
              <strong>{dashboard.source === "live" ? "Live data" : "Preview"}</strong>
              <em>Summary acceleration ready</em>
            </article>
          </section>
          <section className="opsCommandGrid" aria-label="AI traffic operations summary">
            <article className="opsCommandCard primary">
              <span>AI requests</span>
              <strong>{aiRequestKpi?.value ?? "0"}</strong>
              <p>{aiRequestKpi?.label || "Tracked AI requests"}</p>
            </article>
            <article className="opsCommandCard">
              <span>AI systems detected</span>
              <strong>{dashboard.botDistribution?.length || 0}</strong>
              <p>{topAiSystem?.label ? `${topAiSystem.label} is currently the top operator.` : "Operators appear after live crawler events."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Suspicious pressure</span>
              <strong>{suspiciousInsight?.value ?? "0"}</strong>
              <p>{suspiciousInsight?.detail || "Suspicious crawler activity will surface here."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Governed requests</span>
              <strong>{governedShare?.value ?? "0"}</strong>
              <p>{verifiedDomainCount > 0 ? `${verifiedDomainCount} verified domain${verifiedDomainCount === 1 ? "" : "s"} under policy.` : "Verify a domain to enforce workspace policy."}</p>
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
          <section className="dashboardGrid">
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Governance snapshot</span>
                  <h2>Policy readiness</h2>
                </div>
                <StatusBadge status={verifiedDomainCount > 0 ? "Ready" : "Pending"} />
              </div>
              <div className="infraHealthList">
                <div>
                  <span>Domain verification</span>
                  <strong>{verifiedDomainCount > 0 ? "Verified" : "Connect domain"}</strong>
                  <em>{verifiedDomainCount || 0} domains ready for policy decisions</em>
                </div>
                <div>
                  <span>Crawler policies</span>
                  <strong>Monitor first</strong>
                  <em>Governance decisions are visible before enforcement</em>
                </div>
                <div>
                  <span>Licensing readiness</span>
                  <strong>Prepared</strong>
                  <em>Usage evidence can support future content terms</em>
                </div>
              </div>
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">System health</span>
                  <h2>Ingestion infrastructure</h2>
                </div>
                <StatusBadge status={installHealth.status === "active" ? "Healthy" : "Pending"} />
              </div>
              <div className="infraHealthList">
                <div>
                  <span>Ingestion</span>
                  <strong>{installHealth.sdkInstalled ? "Receiving" : "Waiting"}</strong>
                  <em>Tracker endpoint and payload validation ready</em>
                </div>
                <div>
                  <span>Queue and jobs</span>
                  <strong>Ready</strong>
                  <em>Background processing foundation available</em>
                </div>
                <div>
                  <span>Rate limits</span>
                  <strong>Protected</strong>
                  <em>Workspace and route abuse controls enabled</em>
                </div>
              </div>
            </article>
          </section>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Live stream</span>
                <h2>Recent AI access events</h2>
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
                      <th>Time</th>
                      <th>Operator</th>
                      <th>Page</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentActivity.map((row) => (
                      <tr key={row.id}>
                        <td>{row.time}</td>
                        <td>{row.bot}</td>
                        <td>{row.page}</td>
                        <td>{row.category || "AI crawler"}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>{row.tokens}</td>
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
