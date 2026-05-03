import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import { DistributionChart, MiniBars, TrafficChart } from "../components/Charts.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function Analytics() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.analytics && !state.loading.analytics) {
      actions.loadAnalytics();
    }
  }, [actions, state.analytics, state.loading.analytics]);

  const analytics = state.analytics;

  return (
    <AppShell title="Analytics" eyebrow="Usage intelligence">
      {!analytics ? (
        <div className="loadingState">Loading analytics...</div>
      ) : (
        <>
          <section className="dashboardGrid">
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Usage trends</span>
                  <h2>AI requests by month</h2>
                </div>
              </div>
              <TrafficChart data={analytics.trend} />
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Traffic sources</span>
                  <h2>Source mix</h2>
                </div>
              </div>
              <DistributionChart data={analytics.sources} />
            </article>
          </section>
          <section className="dashboardGrid">
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Bot frequency</span>
                  <h2>Requests by bot</h2>
                </div>
              </div>
              <MiniBars data={analytics.botFrequency.map((item) => ({ label: item.bot.split("-")[0], value: item.requests }))} />
            </article>
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Top pages</span>
                  <h2>Highest value content</h2>
                </div>
              </div>
              {analytics.topPages.length === 0 ? (
                <div className="emptyState">
                  <strong>No top pages yet</strong>
                  <p>AI traffic data will appear here after your first tracked crawler events.</p>
                </div>
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th>Visits</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topPages.map((row) => (
                        <tr key={row.page}>
                          <td>{row.page}</td>
                          <td>{row.visits}</td>
                          <td>{row.revenue}</td>
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
