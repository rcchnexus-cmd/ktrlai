import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import { DistributionChart, MiniBars, TrafficChart } from "../components/Charts.jsx";
import {
  AIAccessDecisions,
  AIOperatorIntelligence
} from "../components/SignatureWidgets.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

export default function Analytics() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!state.analytics && !state.loading.analytics && !state.errors.analytics) {
      actions.loadAnalytics();
    }
  }, [actions, state.analytics, state.errors.analytics, state.loading.analytics]);

  const analytics = state.analytics;
  const analyticsError = state.errors.analytics;
  const dataLabel = analytics?.sourceLabel || "Awaiting tracking data";
  const dataDetail = analytics?.sourceDetail || "Install the tracker to begin live traffic intelligence.";
  const totalEvents = analytics?.trend?.reduce((sum, item) => sum + Number(item.value || 0), 0) || 0;
  const topOperator = analytics?.topDetectedAiSystems?.[0]?.name || analytics?.botFrequency?.[0]?.bot || "Pending";
  const topOperatorCount = analytics?.topDetectedAiSystems?.[0]?.count || analytics?.botFrequency?.[0]?.requests || 0;
  const topPage = analytics?.topPages?.[0]?.page || "No path yet";
  const governedBreakdown = analytics?.detectionInsights?.find((insight) => /blocked|allowed|governed|policy/i.test(insight.label));
  const suspiciousInsight = analytics?.detectionInsights?.find((insight) => /suspicious|scrap/i.test(`${insight.label} ${insight.detail}`));
  const visibilityTrend = analytics?.trend?.length ? analytics.trend[analytics.trend.length - 1]?.value || 0 : 0;

  return (
    <AppShell
      title="Traffic Intelligence"
      eyebrow="Analytics"
      subtitle="Measure operator intelligence, access trends, governance outcomes, visibility growth, and licensing readiness."
    >
      {analyticsError ? (
        <div className="emptyState">
          <strong>Analytics could not be loaded</strong>
          <p>{analyticsError}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadAnalytics}>
              Retry analytics
            </button>
            <RouteLink to="/docs/analytics" className="primaryButton smallButton">
              Read analytics guide
            </RouteLink>
          </div>
        </div>
      ) : !analytics ? (
        <div className="loadingState">Loading analytics...</div>
      ) : (
        <>
          <section className="commandHero analyticsCommandHero" aria-label="AI traffic intelligence command summary">
            <div className="commandHeroCopy">
              <span className="eyebrow">AI traffic intelligence</span>
              <h2>Operator demand, visibility lift, and policy outcomes.</h2>
              <p>Connect request volume with top operators, high-impact paths, suspicious pressure, and governance decisions.</p>
            </div>
            <div className="commandHeroMetrics">
              <article>
                <span>Access trends</span>
                <strong>{totalEvents}</strong>
                <em>Requests in window</em>
              </article>
              <article>
                <span>Top operator</span>
                <strong>{topOperator}</strong>
                <em>{topOperatorCount || 0} observed</em>
              </article>
              <article>
                <span>Visibility growth</span>
                <strong>{visibilityTrend}</strong>
                <em>Latest period</em>
              </article>
              <article>
                <span>Governance outcomes</span>
                <strong>{governedBreakdown?.value ?? "0"}</strong>
                <em>Policy signals</em>
              </article>
            </div>
          </section>
          <section className={`dataModeNotice ${analytics.source || "empty"}`} aria-label="Analytics data status">
            <StatusBadge status={dataLabel} />
            <span>{dataDetail}</span>
          </section>
          <section className="opsCommandGrid trafficIntelGrid" aria-label="Traffic intelligence summary">
            <article className="opsCommandCard primary">
              <span>AI retrieval requests</span>
              <strong>{totalEvents}</strong>
              <p>Events in the current analysis window.</p>
            </article>
            <article className="opsCommandCard">
              <span>Top operator</span>
              <strong>{topOperator}</strong>
              <p>{topOperatorCount ? `${topOperatorCount} requests observed.` : "Operators appear after live events."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Suspicious pressure</span>
              <strong>{suspiciousInsight?.value ?? "0"}</strong>
              <p>{suspiciousInsight?.detail || "Crawler pressure and scraping signals are tracked here."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Highest-impact path</span>
              <strong>{topPage}</strong>
              <p>{governedBreakdown?.detail || "Evidence is grouped by content path."}</p>
            </article>
          </section>
          {analytics.detectionInsights?.length ? (
            <section className="detectionInsightGrid" aria-label="AI detection analytics">
              {analytics.detectionInsights.map((insight) => (
                <article className={`detectionInsight ${insight.tone || "neutral"}`} key={insight.label}>
                  <span>{insight.label}</span>
                  <strong>{insight.value}</strong>
                  <em>{insight.detail}</em>
                </article>
              ))}
            </section>
          ) : null}
          <section className="insightNarrativeGrid" aria-label="Traffic intelligence insights">
            <AIOperatorIntelligence
              operator={topOperator}
              trustLevel={(suspiciousInsight?.value || 0) ? "Review" : "Observed"}
              activity={topOperatorCount ? `${topOperatorCount} requests` : "Awaiting live volume"}
              permission="Traffic intelligence"
              detail={topOperatorCount ? `${topOperator} is the strongest observed AI operator in this window.` : "Operator intelligence begins after live tracker events arrive."}
              operators={(analytics.topDetectedAiSystems || []).map((item) => item.name)}
            />
            <AIAccessDecisions
              allowed={totalEvents}
              denied={suspiciousInsight?.value ?? 0}
              training={0}
              licensing={0}
              review={governedBreakdown?.value ?? 0}
              detail="Traffic intelligence groups observed requests with suspicious pressure and policy outcomes."
            />
            <article className="signatureWidget">
              <span className="eyebrow">Needs attention</span>
              <h2>{suspiciousInsight?.value ?? "0"} signals</h2>
              <p>{suspiciousInsight?.detail || "Suspicious pressure and scraping patterns will surface here."}</p>
            </article>
            <article className="signatureWidget">
              <span className="eyebrow">Value created</span>
              <h2>{topPage}</h2>
              <p>High-impact content paths become evidence for governance and licensing readiness.</p>
            </article>
          </section>
          <section className="dashboardGrid">
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Traffic trend</span>
                  <h2>Operator traffic by period</h2>
                </div>
              </div>
              <TrafficChart data={analytics.trend} />
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Source mix</span>
                  <h2>Traffic composition</h2>
                </div>
              </div>
              <DistributionChart data={analytics.sources} />
            </article>
          </section>
          <section className="dashboardGrid">
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Operator frequency</span>
                  <h2>Requests by crawler</h2>
                </div>
              </div>
              <MiniBars data={analytics.botFrequency.map((item) => ({ label: item.bot.split("-")[0], value: item.requests }))} />
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Operators</span>
                  <h2>Top detected systems</h2>
                </div>
              </div>
              {(analytics.topDetectedAiSystems || []).length === 0 ? (
                <div className="emptyState compact">
                  <strong>No systems detected yet</strong>
                  <p>Known AI crawler names will appear after live tracker events arrive.</p>
                </div>
              ) : (
                <div className="adminList">
                  {analytics.topDetectedAiSystems.map((bot) => (
                    <div key={bot.name}>
                      <span>{bot.name}</span>
                      <strong>{bot.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="panel largePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Top paths</span>
                  <h2>Highest-impact content</h2>
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
                        <th>Modeled value</th>
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
