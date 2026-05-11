import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import MetricCard from "../components/MetricCard.jsx";
import { DistributionChart, TrafficChart } from "../components/Charts.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

export default function Dashboard() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.dashboard && !state.loading.dashboard && !state.errors.dashboard) {
      actions.loadDashboard();
    }
  }, [actions, state.dashboard, state.errors.dashboard, state.loading.dashboard]);

  useEffect(() => {
    if (state.auth.isAuthenticated && !state.settings && !state.loading.settings) {
      actions.loadSettings();
    }
  }, [actions, state.auth.isAuthenticated, state.loading.settings, state.settings]);

  const dashboard = state.dashboard;
  const dashboardError = state.errors.dashboard;
  const domains = Array.isArray(state.settings?.domains) ? state.settings.domains : null;
  const shouldShowOnboarding = Boolean(state.settings && domains?.length === 0);
  const dataLabel = dashboard?.sourceLabel || "Awaiting tracking data";
  const dataDetail = dashboard?.sourceDetail || "Install your tracker to start seeing live AI access analytics.";

  return (
    <AppShell
      title="Dashboard"
      eyebrow="AI command center"
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
        </div>
      ) : !dashboard ? (
        <div className="loadingState">Loading AI activity...</div>
      ) : (
        <>
          {shouldShowOnboarding && (
            <section className="onboardingCard panel" aria-label="KtrlAI onboarding checklist">
              <div className="onboardingCopy">
                <span className="eyebrow">Workspace setup</span>
                <h2>Welcome to KtrlAI</h2>
                <p>Add your first domain, install the tracker, and KtrlAI will start turning AI access into visibility, policy, and revenue signals.</p>
              </div>
              <div className="onboardingSteps">
                <article>
                  <span>1</span>
                  <strong>Add your domain</strong>
                  <p>Connect the website you want to monitor and verify ownership.</p>
                </article>
                <article>
                  <span>2</span>
                  <strong>Install tracking script</strong>
                  <p>Copy the workspace script into your site header or tag manager.</p>
                </article>
                <article>
                  <span>3</span>
                  <strong>Start monitoring AI activity</strong>
                  <p>Watch AI bot visits, policy outcomes, and monetization opportunities appear here.</p>
                </article>
              </div>
              <div className="onboardingActions">
                <RouteLink to="/settings" className="primaryButton smallButton">
                  Add domain
                </RouteLink>
                <RouteLink to="/visibility" className="secondaryButton smallButton">
                  Check visibility
                </RouteLink>
              </div>
            </section>
          )}
          <section className={`dataModeNotice ${dashboard.source || "empty"}`} aria-label="Dashboard data status">
            <StatusBadge status={dataLabel} />
            <span>{dataDetail}</span>
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
