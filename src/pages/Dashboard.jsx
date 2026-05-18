import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
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
      title="Operations"
      eyebrow="Monitor"
      action={
        <RouteLink to="/visibility" className="primaryButton smallButton">
          Check site
        </RouteLink>
      }
    >
      {dashboardError ? (
        <div className="emptyState">
          <strong>Operations data could not be loaded</strong>
          <p>{dashboardError}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadDashboard}>
              Retry operations
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
          <section className={`dataModeNotice ${dashboard.source || "empty"}`} aria-label="Operations data status">
            <StatusBadge status={dataLabel} />
            <span>{dataDetail}</span>
          </section>
          <section className="opsStatusRail" aria-label="Workspace infrastructure status">
            <article>
              <span>Plan</span>
              <strong>{state.auth.user?.plan || "Free"}</strong>
              <em>{state.auth.workspace?.name || "Workspace"}</em>
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
              <span>Rate limits</span>
              <strong>Active</strong>
              <em>Redis-ready abuse controls</em>
            </article>
            <article>
              <span>Rollups</span>
              <strong>{dashboard.source === "live" ? "Healthy" : "Ready"}</strong>
              <em>Analytics acceleration</em>
            </article>
            <article>
              <span>Policies</span>
              <strong>{verifiedDomainCount > 0 ? "Active" : "Pending"}</strong>
              <em>{verifiedDomainCount || 0} verified domains</em>
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
            <article className="opsCommandCard">
              <span>Top operator</span>
              <strong>{topAiSystem?.label || "Pending"}</strong>
              <p>{topAiSystem?.value ? `${topAiSystem.value}% of detected crawler mix.` : "Top operator appears after live traffic."}</p>
            </article>
          </section>
          <section className="panel activityStreamPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Live AI access feed</span>
                <h2>Latest crawler events</h2>
              </div>
              <RouteLink to="/activity" className="textLink">
                View stream
              </RouteLink>
            </div>
            {dashboard.recentActivity.length === 0 ? (
              <div className="emptyState">
                <strong>No recent AI activity</strong>
                <p>Install the tracker script or run a visibility check to start collecting AI access events.</p>
              </div>
            ) : (
              <div className="tableWrap">
                <table className="activityLogTable">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Operator</th>
                      <th>Path</th>
                      <th>Category</th>
                      <th>Action</th>
                      <th>Risk</th>
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
                        <td>{/block|deny|failed/i.test(row.status) ? "Attention" : "Monitor"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="dashboardGrid opsTwoColumn">
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
                  <span>Monitored crawlers</span>
                  <strong>{dashboard.botDistribution?.length || 0}</strong>
                  <em>Known operators tracked by workspace evidence</em>
                </div>
                <div>
                  <span>Restricted crawlers</span>
                  <strong>{suspiciousInsight?.value ?? "0"}</strong>
                  <em>Suspicious or restricted traffic requiring review</em>
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
                  <h2>Infrastructure state</h2>
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
                  <span>Queue</span>
                  <strong>Ready</strong>
                  <em>Background processing foundation available</em>
                </div>
                <div>
                  <span>Redis</span>
                  <strong>Active</strong>
                  <em>Rate-limit provider is ready for shared enforcement</em>
                </div>
                <div>
                  <span>Rollups</span>
                  <strong>{dashboard.source === "live" ? "Healthy" : "Ready"}</strong>
                  <em>Summary analytics are rollup-ready</em>
                </div>
                <div>
                  <span>Notifications</span>
                  <strong>Ready</strong>
                  <em>Workspace alerts can be queued safely</em>
                </div>
              </div>
            </article>
          </section>
          <section className="dashboardGrid opsTwoColumn">
            <article className="panel">
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
                  <span className="eyebrow">Operator mix</span>
                  <h2>Detected crawler distribution</h2>
                </div>
              </div>
              <DistributionChart data={dashboard.botDistribution} />
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
