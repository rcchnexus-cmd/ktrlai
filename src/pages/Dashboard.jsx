import { useEffect } from "react";
import AppShell from "../components/AppShell.jsx";
import SetupGuide from "../components/SetupGuide.jsx";
import { DistributionChart, TrafficChart } from "../components/Charts.jsx";
import {
  AIAccessDecisions,
  AIOperatorIntelligence,
  CrawlerEvidenceStream,
  GovernanceCoverage,
  LicensingReadiness
} from "../components/SignatureWidgets.jsx";
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
  const observedOperators =
    dashboard?.botDistribution?.map((item) => item.label).filter(Boolean).slice(0, 5) || [];
  const commandOperators = observedOperators.length
    ? observedOperators
    : ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Unknown crawler"];
  const observedAssets = [
    ...new Set((dashboard?.recentActivity || []).map((row) => row.page).filter(Boolean))
  ].slice(0, 4);
  const commandAssets = observedAssets.length
    ? observedAssets
    : ["/pricing", "/docs/api", "/blog/licensing", "/premium/*"];
  const governedValue = Number.parseInt(String(governedShare?.value || "0").replace(/[^0-9.-]/g, ""), 10) || 0;
  const activeRuleCount = Math.max(verifiedDomainCount, governedValue, 0);
  const riskEventCount = suspiciousInsight?.value ?? "0";
  const licensingReadyAssets = pagesAccessedKpi?.value ?? commandAssets.length;
  const accessDecisionCount = dashboard?.recentActivity?.length || 0;
  const protectedAssetCount = commandAssets.length;
  const topAssets = commandAssets.slice(0, 4);
  const governanceCoverage = Math.min(92, Math.max(18, activeRuleCount * 18));
  const deniedDecisionCount = Number.parseInt(String(riskEventCount).replace(/[^0-9.-]/g, ""), 10) || 0;
  const monitorDecisionCount = Math.max(0, accessDecisionCount - deniedDecisionCount);
  const evidenceRows = (dashboard?.recentActivity || []).map((row) => ({
    id: row.id,
    time: row.time,
    operator: row.bot,
    path: row.page,
    policy: row.policyAction || row.policy || row.category || "Monitor",
    status: /block|deny|failed/i.test(row.status) ? "Attention" : row.status || "Observed"
  }));

  return (
    <AppShell
      title="AI Access Command Center"
      eyebrow="Operations"
      subtitle="Monitor AI operators, access decisions, governance outcomes, and licensing readiness across your tracked assets."
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
          <section className={`dataModeNotice ${dashboard.source || "empty"}`} aria-label="Operations data status">
            <StatusBadge status={dataLabel} />
            <span>{dataDetail}</span>
          </section>
          <section className="panel app-control-widget aiCommandCenter commandHero commandHeroOperations" aria-label="AI Access Command Center">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Mission control</span>
                <h2>AI Access Command Center</h2>
                <p>Connect AI operators, accessed assets, access rules, and evidence outcomes in one operating view.</p>
              </div>
              <StatusBadge status={dashboard.source === "live" ? "Receiving events" : "Waiting for live events"} />
            </div>
            <div className="aiCommandStats" aria-label="Command center summary">
              <article>
                <span>Observed operators</span>
                <strong>{dashboard.botDistribution?.length || commandOperators.length}</strong>
              </article>
              <article>
                <span>Access decisions</span>
                <strong>{accessDecisionCount}</strong>
              </article>
              <article>
                <span>Protected assets</span>
                <strong>{protectedAssetCount}</strong>
              </article>
              <article>
                <span>Licensing ready</span>
                <strong>{licensingReadyAssets}</strong>
              </article>
            </div>
            <div className="aiCommandCenterCanvas">
              <div className="commandColumn">
                <span className="commandColumnLabel">Observed operators</span>
                {commandOperators.map((operator) => (
                  <strong className="commandNode operator" key={operator}>
                    {operator}
                  </strong>
                ))}
              </div>
              <div className="commandColumn">
                <span className="commandColumnLabel">Observed assets</span>
                {commandAssets.map((asset) => (
                  <code className="commandNode asset" key={asset}>
                    {asset}
                  </code>
                ))}
              </div>
              <div className="commandColumn policy">
                <span className="commandColumnLabel">Access rule</span>
                {["Monitor", "Allow", "Restrict", "Review", "Charge-ready"].map((policy) => (
                  <span className="commandNode policyState" key={policy}>
                    {policy}
                  </span>
                ))}
              </div>
              <div className="commandColumn outcome">
                <span className="commandColumnLabel">Outcome</span>
                {["Logged", "Evidence stored", "Workflow prepared", "Licensing candidate"].map((outcome) => (
                  <span className="commandNode outcomeState" key={outcome}>
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
          </section>
          <section className="opsStatusRail" aria-label="Workspace runtime status">
            <article>
              <span>Tracker</span>
              <strong>{getInstallStatusLabel(installHealth.status)}</strong>
              <em>{installHealth.sdkInstalled ? "SDK detected" : "Awaiting SDK"}</em>
            </article>
            <article>
              <span>Events</span>
              <strong>{installHealth.sdkInstalled ? "Receiving" : "Waiting"}</strong>
              <em>{formatInstallDate(installHealth.lastEventAt)}</em>
            </article>
            <article>
              <span>Policies</span>
              <strong>{verifiedDomainCount > 0 ? "Monitoring" : "Pending"}</strong>
              <em>{verifiedDomainCount || 0} verified domains</em>
            </article>
            <article>
              <span>Intelligence</span>
              <strong>{dashboard.source === "live" ? "Updated" : "Ready"}</strong>
              <em>Rollup-ready summaries</em>
            </article>
            <article>
              <span>Licensing</span>
              <strong>Beta</strong>
              <em>Commercial workflow preparation</em>
            </article>
            <article>
              <span>Workspace</span>
              <strong>{state.auth.workspace?.name || "Workspace"}</strong>
              <em>{state.auth.user?.plan || "Free"} plan</em>
            </article>
          </section>
          <section className="signatureWidgetGrid operationsSignatureGrid" aria-label="Mission critical command widgets">
            <AIOperatorIntelligence
              operator={topAiSystem?.label || commandOperators[0]}
              trustLevel={deniedDecisionCount ? "Mixed trust" : "Observed"}
              activity={topAiSystem?.value ? `${topAiSystem.value} requests` : "Awaiting live volume"}
              permission="Monitor"
              detail="Operator identity, trust posture, activity volume, and current access permission stay connected."
              operators={commandOperators}
            />
            <GovernanceCoverage
              coverage={governanceCoverage}
              assetsProtected={protectedAssetCount}
              policiesActive={activeRuleCount}
              trainingRules={0}
              licensingRules={Number.parseInt(String(licensingReadyAssets).replace(/[^0-9.-]/g, ""), 10) || 0}
              detail="Policies are monitoring access outcomes for verified domains and high-value paths."
            />
            <AIAccessDecisions
              allowed={monitorDecisionCount}
              denied={deniedDecisionCount}
              training={0}
              licensing={Number.parseInt(String(licensingReadyAssets).replace(/[^0-9.-]/g, ""), 10) || 0}
              review={Math.max(0, accessDecisionCount - monitorDecisionCount)}
            />
            <LicensingReadiness
              score={dashboard.source === "live" ? 64 : 32}
              eligibleAssets={licensingReadyAssets}
              chargeReadyAssets={activeRuleCount}
              opportunityLevel="Beta planning"
            />
          </section>
          {shouldShowOnboarding && (
            <SetupGuide settings={state.settings} dashboard={dashboard} />
          )}
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
            <CrawlerEvidenceStream rows={evidenceRows} />
          </section>
          <section className="operationalIntelligenceGrid" aria-label="Operational intelligence">
            <article className="panel intelligenceTrendCard">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Access trends</span>
                  <h2>AI request volume</h2>
                </div>
                <em>7 days</em>
              </div>
              <TrafficChart data={dashboard.traffic} />
            </article>
            <article className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Top operators</span>
                  <h2>Observed AI systems</h2>
                </div>
              </div>
              <DistributionChart data={dashboard.botDistribution} />
            </article>
            <article className="panel intelligenceListCard">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Top assets</span>
                  <h2>Protected paths</h2>
                </div>
              </div>
              <div className="dashboardSignalList compact">
                {topAssets.map((asset) => (
                  <div key={asset}>
                    <strong>{asset}</strong>
                    <em>Evidence-ready tracked asset</em>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel crawlerPolicyPanel intelligencePolicyCard">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Governance outcomes</span>
                  <h2>Access decisions</h2>
                </div>
                <RouteLink to="/control" className="textLink">
                  Manage rules
                </RouteLink>
              </div>
              <p className="honestPolicyNote">
                Network-level blocking is not enabled yet. Policies currently drive visibility, workflow, and tracker metadata.
              </p>
              <div className="crawlerPolicyTable compact" role="table" aria-label="Governance outcomes">
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
            <article className="panel readinessPanel intelligenceReadinessCard">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Licensing opportunities</span>
                  <h2>Commercial readiness</h2>
                </div>
                <StatusBadge status="Beta" />
              </div>
              <div className="readinessTagGrid">
                {monetizationReadiness.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <p>Pay Per Crawl workflows remain readiness-oriented until commercial charging and enforcement are explicitly enabled.</p>
            </article>
            <article className="panel readinessPanel intelligenceResourcesCard">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Developer resources</span>
                  <h2>Setup and reference</h2>
                </div>
                <RouteLink to="/settings" className="textLink">
                  Open config
                </RouteLink>
              </div>
              <div className="readinessTagGrid">
                {[...configurationReadiness.slice(0, 3), ...developerResources.slice(0, 3)].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          </section>
          <section className="recommendedActionPanel panel">
            <div>
              <span className="eyebrow">Recommended next actions</span>
              <h2>Move from visibility to control.</h2>
              <p>Complete the operating loop: verify ingestion, review live evidence, tune access rules, and prepare licensing candidates.</p>
            </div>
            <div className="recommendedActionList">
              <RouteLink to="/activity">Review live evidence</RouteLink>
              <RouteLink to="/control">Tune access rules</RouteLink>
              <RouteLink to="/analytics">Inspect traffic intelligence</RouteLink>
              <RouteLink to="/settings#install">Verify tracker install</RouteLink>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
