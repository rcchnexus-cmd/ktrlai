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
    if (!state.dashboard && !state.loading.dashboard) {
      actions.loadDashboard();
    }
  }, [actions, state.dashboard, state.loading.dashboard]);

  const dashboard = state.dashboard;

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
      {!dashboard ? (
        <div className="loadingState">Loading AI activity...</div>
      ) : (
        <>
          <section className="metricGrid">
            {dashboard.kpis.map((kpi) => (
              <MetricCard key={kpi.label} {...kpi} />
            ))}
          </section>
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
