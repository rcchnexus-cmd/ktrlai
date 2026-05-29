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

const controlPlaneAreas = [
  ["Overview", "/dashboard", "Workspace status, setup, telemetry, and evidence stream.", "Live"],
  ["Get started", "/settings#install", "Domain, API key, tracker install, and first event workflow.", "Setup"],
  ["Analyze AI traffic", "/analytics", "Date, crawler, operator, hostname, path, and outcome analysis.", "Traffic"],
  ["Manage crawlers", "/control", "Operator policies for allow, monitor, restrict, and charge-ready states.", "Govern"],
  ["Directives / robots.txt", "/settings#domains", "Robots and llms.txt readiness for agent-access documentation.", "Signals"],
  ["Monetization readiness", "/monetization", "Pay Per Crawl-style pricing and payout preparedness.", "Beta"],
  ["Configuration", "/settings", "Tracker, keys, domains, notifications, security, and audit logs.", "Config"],
  ["Developer tools", "/docs/sdk", "API reference, install snippets, webhook readiness, and bot reference.", "Docs"]
];

const trafficFilters = ["Date range", "Crawler", "Operator", "Hostname", "Path"];
const trafficSignals = [
  "AI requests over time",
  "Top crawlers",
  "Top operators",
  "Top accessed paths",
  "Suspicious requests",
  "Governance outcomes"
];

const crawlerPolicyRows = [
  ["GPTBot", "OpenAI", "Monitor", "Measure AI visibility before restriction.", "12:04"],
  ["PerplexityBot", "Perplexity", "Restrict", "High-value docs require review workflow.", "11:48"],
  ["ClaudeBot", "Anthropic", "Allow", "Low-risk content discovery remains visible.", "10:31"],
  ["Unknown scraper", "Unverified", "Charge-ready", "Commercial access requires pricing review.", "09:52"]
];

const monetizationReadiness = [
  "Pay Per Crawl readiness",
  "Price rules",
  "Selectable crawlers",
  "Payout readiness",
  "Payable content discovery",
  "Crawl pricing logic"
];

const configurationReadiness = [
  "Tracker installation",
  "API keys",
  "Domains",
  "Robots/directives",
  "WAF-style future enforcement note",
  "Bot detection confidence"
];

const developerResources = [
  "API reference",
  "Bot/operator reference",
  "Webhook readiness",
  "llms.txt readiness",
  "Markdown-friendly docs",
  "Install snippet"
];

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
  const dataDetail = dashboard?.sourceDetail || "Install the tracker to begin live AI access telemetry.";
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
  const pagesAccessedKpi = dashboard?.kpis?.find((kpi) => /page/i.test(kpi.label));

  return (
    <AppShell
      title="Operations"
      eyebrow="Monitor"
      subtitle="Your AI access command center: setup, crawler evidence, access rules, and monetization readiness."
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
        <div className="loadingState">Loading operations telemetry...</div>
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
              <span>Tracker</span>
              <strong>{getInstallStatusLabel(installHealth.status)}</strong>
              <em>{installHealth.sdkInstalled ? "SDK detected" : "Awaiting SDK"}</em>
            </article>
            <article>
              <span>Policies</span>
              <strong>{verifiedDomainCount > 0 ? "Active" : "Pending"}</strong>
              <em>{verifiedDomainCount || 0} verified domains</em>
            </article>
            <article>
              <span>Ingestion</span>
              <strong>{installHealth.sdkInstalled ? "Receiving" : "Waiting"}</strong>
              <em>{formatInstallDate(installHealth.lastEventAt)}</em>
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
              <span>Notifications</span>
              <strong>Ready</strong>
              <em>{installHealth.eventsToday || 0} events today</em>
            </article>
          </section>
          <section className="panel dashboardFeatureMapPanel" aria-label="KtrlAI control plane areas">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Control plane map</span>
                <h2>AI crawl control workflow</h2>
              </div>
              <div className="panelActions">
                <RouteLink to="/settings#install" className="secondaryButton smallButton">
                  View install
                </RouteLink>
                <RouteLink to="/docs" className="secondaryButton smallButton">
                  Docs
                </RouteLink>
              </div>
            </div>
            <div className="dashboardFeatureGrid">
              {controlPlaneAreas.map(([title, to, body, status]) => (
                <RouteLink to={to} className="dashboardFeatureCard" key={title}>
                  <span>{status}</span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </RouteLink>
              ))}
            </div>
          </section>
          <section className="opsCommandGrid" aria-label="AI traffic operations summary">
            <article className="opsCommandCard primary">
              <span>AI requests</span>
              <strong>{aiRequestKpi?.value ?? "0"}</strong>
              <p>{aiRequestKpi?.label || "Tracked AI requests"}</p>
            </article>
            <article className="opsCommandCard">
              <span>Operators detected</span>
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
              <span>Pages accessed</span>
              <strong>{pagesAccessedKpi?.value ?? "0"}</strong>
              <p>{pagesAccessedKpi?.change || "Accessed paths appear after live tracker events."}</p>
            </article>
            <article className="opsCommandCard">
              <span>Top operator</span>
              <strong>{topAiSystem?.label || "Pending"}</strong>
              <p>{topAiSystem?.value ? `${topAiSystem.value}% of detected crawler mix.` : "Top operator appears after live traffic."}</p>
            </article>
          </section>
          <section className="dashboardGrid opsTwoColumn dashboardScopeGrid">
            <article className="panel trafficScopePanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Traffic intelligence</span>
                  <h2>Analysis scope</h2>
                </div>
                <RouteLink to="/analytics" className="textLink">
                  Open analytics
                </RouteLink>
              </div>
              <div className="dashboardFilterRail" aria-label="Available analytics filters">
                {trafficFilters.map((filter) => (
                  <span key={filter}>{filter}</span>
                ))}
              </div>
              <div className="dashboardSignalList">
                {trafficSignals.map((signal) => (
                  <div key={signal}>
                    <strong>{signal}</strong>
                    <em>Supported by live activity and rollup-ready summaries</em>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel crawlerPolicyPanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Manage crawlers</span>
                  <h2>Policy matrix</h2>
                </div>
                <RouteLink to="/control" className="textLink">
                  Manage policies
                </RouteLink>
              </div>
              <p className="honestPolicyNote">
                Network-level blocking is not enabled yet. Policies currently drive visibility, workflow, and tracker metadata.
              </p>
              <div className="crawlerPolicyTable" role="table" aria-label="Crawler policy readiness">
                <div className="crawlerPolicyHeader" role="row">
                  <span>Crawler</span>
                  <span>Operator</span>
                  <span>Action</span>
                  <span>Reason</span>
                  <span>Evidence</span>
                </div>
                {crawlerPolicyRows.map(([crawler, operator, action, reason, timestamp]) => (
                  <div className="crawlerPolicyRow" role="row" key={`${crawler}-${action}`}>
                    <strong>{crawler}</strong>
                    <span>{operator}</span>
                    <em>{action}</em>
                    <p>{reason}</p>
                    <code>{timestamp}</code>
                  </div>
                ))}
              </div>
            </article>
          </section>
          <section className="panel activityStreamPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Live AI access feed</span>
                <h2>Latest access events</h2>
              </div>
              <RouteLink to="/activity" className="textLink">
                View stream
              </RouteLink>
            </div>
            {dashboard.recentActivity.length === 0 ? (
              <div className="emptyState">
                <strong>No recent AI activity</strong>
                <p>Install the tracker or run a visibility check to start collecting access evidence.</p>
              </div>
            ) : (
              <div className="opsEvidenceStream" role="table" aria-label="Latest AI access evidence">
                <div className="opsEvidenceHeader" role="row">
                  <span>Timestamp</span>
                  <span>Operator</span>
                  <span>Path</span>
                  <span>Action</span>
                  <span>Policy</span>
                  <span>Risk</span>
                </div>
                {dashboard.recentActivity.map((row) => {
                  const risk = /block|deny|failed/i.test(row.status) ? "Attention" : "Monitor";

                  return (
                    <div className="opsEvidenceRow" role="row" key={row.id}>
                      <span className="opsEvidenceTime">{row.time}</span>
                      <strong className="opsEvidenceOperator">{row.bot}</strong>
                      <code className="opsEvidencePath">{row.page}</code>
                      <span>
                        <StatusBadge status={row.status} />
                      </span>
                      <span className="opsEvidencePolicy">{row.policyAction || row.policy || row.category || "Monitor"}</span>
                      <span className={risk === "Attention" ? "opsEvidenceRisk attention" : "opsEvidenceRisk"}>{risk}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="dashboardGrid governanceOnlyGrid">
            <article className="panel governanceSnapshotPanel">
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
                  <em>Operators tracked by workspace evidence</em>
                </div>
                <div>
                  <span>Restricted crawlers</span>
                  <strong>{suspiciousInsight?.value ?? "0"}</strong>
                  <em>Traffic requiring review</em>
                </div>
                <div>
                  <span>Licensing readiness</span>
                  <strong>Prepared</strong>
                  <em>Usage evidence supports future content terms</em>
                </div>
                <div>
                  <span>Training-related</span>
                  <strong>{dashboard.botDistribution?.some((item) => /gpt|claude|perplexity|google/i.test(item.label || "")) ? "Detected" : "Watching"}</strong>
                  <em>AI access evidence can inform training policy reviews</em>
                </div>
              </div>
            </article>
          </section>
          <section className="dashboardGrid readinessGrid">
            <article className="panel readinessPanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Monetization readiness</span>
                  <h2>Future crawl pricing workflow</h2>
                </div>
                <StatusBadge status="Beta" />
              </div>
              <div className="readinessTagGrid">
                {monetizationReadiness.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>Pay Per Crawl workflows are readiness-oriented until commercial charging and enforcement are explicitly enabled.</p>
            </article>
            <article className="panel readinessPanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Configuration</span>
                  <h2>Operational setup blocks</h2>
                </div>
                <RouteLink to="/settings" className="textLink">
                  Open config
                </RouteLink>
              </div>
              <div className="readinessTagGrid">
                {configurationReadiness.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <article className="panel readinessPanel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Developer / agent resources</span>
                  <h2>Reference readiness</h2>
                </div>
                <RouteLink to="/docs" className="textLink">
                  View docs
                </RouteLink>
              </div>
              <div className="readinessTagGrid">
                {developerResources.map((item) => (
                  <span key={item}>{item}</span>
                ))}
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
