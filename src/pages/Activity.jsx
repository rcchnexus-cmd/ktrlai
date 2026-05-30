import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import {
  AIOperatorIntelligence,
  CrawlerEvidenceStream
} from "../components/SignatureWidgets.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

function getEventSeverity(row) {
  const text = `${row.status || ""} ${row.category || ""} ${row.type || ""}`.toLowerCase();

  if (/block|deny|failed|suspicious|scraper/.test(text)) {
    return "Attention";
  }

  if (/allow|verified|success|trusted/.test(text)) {
    return "Normal";
  }

  return "Monitor";
}

export default function Activity() {
  const { state, actions } = useApp();
  const [search, setSearch] = useState("");
  const [botType, setBotType] = useState("All");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState("All");

  useEffect(() => {
    if (!state.activityMeta?.loaded && !state.loading.activity && !state.errors.activity) {
      actions.loadActivity();
    }
  }, [actions, state.activityMeta?.loaded, state.errors.activity, state.loading.activity]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !state.activityMeta?.loaded) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        actions.loadActivity();
      }
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [actions, state.activityMeta?.loaded, state.auth.isAuthenticated]);

  const filtered = useMemo(() => {
    return state.activity.filter((row) => {
      const query = `${row.bot} ${row.page} ${row.type}`.toLowerCase();
      const matchesSearch = query.includes(search.toLowerCase());
      const matchesType = botType === "All" || row.type === botType;
      const matchesStatus = status === "All" || row.status === status;
      const matchesDate = date === "All" || row.date === date;
      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [botType, date, search, state.activity, status]);

  const botTypes = ["All", ...new Set(state.activity.map((row) => row.type))];
  const statuses = ["All", ...new Set(state.activity.map((row) => row.status))];
  const dates = ["All", ...new Set(state.activity.map((row) => row.date))];
  const isInitialLoading = state.loading.activity && state.activity.length === 0;
  const activityError = state.errors.activity;
  const activityMeta = state.activityMeta || {};
  const sourceLabel = activityMeta.sourceLabel || "Awaiting tracking data";
  const sourceDetail = activityMeta.sourceDetail || "Install the tracker to collect live AI access evidence.";
  const hasActivityRows = state.activity.length > 0;
  const uniqueOperators = [...new Set(filtered.map((row) => row.bot).filter(Boolean))];
  const threatEvents = filtered.filter((row) => getEventSeverity(row) === "Attention");
  const trustedOperators = uniqueOperators.filter((operator) => /gpt|claude|perplexity|google|anthropic|openai/i.test(operator));
  const confidenceEvents = filtered.filter((row) => row.confidenceScore).length;
  const evidenceRows = filtered.map((row) => ({
    id: row.id,
    time: `${row.date} ${row.time}`,
    operator: row.bot,
    path: row.page,
    policy: row.category || row.type || "Monitor",
    status: getEventSeverity(row)
  }));

  return (
    <AppShell
      title="Live AI Access Feed"
      eyebrow="Activity"
      subtitle="Timestamped crawler activity across operators, paths, policies, risk, and evidence."
    >
      <section className="commandHero activityCommandHero" aria-label="Live AI access command summary">
        <div className="commandHeroCopy">
          <span className="eyebrow">Live intelligence</span>
          <h2>Crawler Evidence Ledger</h2>
          <p>Watch operator activity, policy decisions, confidence signals, and threat events as timestamped evidence.</p>
        </div>
        <div className="commandHeroMetrics">
          <article>
            <span>Visible events</span>
            <strong>{filtered.length}</strong>
            <em>{sourceLabel}</em>
          </article>
          <article>
            <span>Operators</span>
            <strong>{uniqueOperators.length}</strong>
            <em>Distinct systems</em>
          </article>
          <article>
            <span>Threat events</span>
            <strong>{threatEvents.length}</strong>
            <em>Require review</em>
          </article>
          <article>
            <span>Confidence</span>
            <strong>{confidenceEvents}</strong>
            <em>Scored signals</em>
          </article>
        </div>
      </section>
      <section className="panel liveIngestionPanel">
        <div className="liveIngestionHeader">
          <div>
            <span className="eyebrow">Ingestion status</span>
            <h2>{sourceLabel}</h2>
          </div>
          <StatusBadge status={sourceLabel} />
        </div>
        <p>{sourceDetail}</p>
      </section>

      <section className="activityRuntimeStrip app-runtime-strip" aria-label="Live feed status">
        <span><i className="app-live-indicator" aria-hidden="true" /> Feed status</span>
        <strong>{sourceLabel}</strong>
        <em>{filtered.length} visible events</em>
      </section>

      <section className="panel">
        <div className="filters">
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bot, page, or type" />
          </label>
          <label>
            Bot type
            <select value={botType} onChange={(event) => setBotType(event.target.value)}>
              {botTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <select value={date} onChange={(event) => setDate(event.target.value)}>
              {dates.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {activityError ? (
        <div className="emptyState">
          <strong>Live stream could not be loaded</strong>
          <p>{activityError}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadActivity}>
              Retry activity
            </button>
            <RouteLink to="/settings#install" className="primaryButton smallButton">
              Open install
            </RouteLink>
          </div>
        </div>
      ) : isInitialLoading ? (
        <div className="loadingState">Loading AI activity logs...</div>
      ) : (
        <section className="panel activityStreamPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Crawler Evidence Ledger</span>
              <h2>{filtered.length} access events</h2>
            </div>
          </div>
          <CrawlerEvidenceStream
            rows={evidenceRows}
            emptyTitle={hasActivityRows ? "No matching events" : "No tracking data yet"}
            emptyDetail={
              hasActivityRows
                ? "Try clearing your search or choosing a broader bot type, status, or date filter."
                : "Install the tracker and generate a live event to start filling this log."
            }
          />
        </section>
      )}
      <section className="signatureWidgetGrid activitySignatureGrid" aria-label="Activity intelligence widgets">
        <AIOperatorIntelligence
          operator={trustedOperators[0] || uniqueOperators[0] || "Awaiting operators"}
          trustLevel={threatEvents.length ? "Mixed trust" : "Observed"}
          activity={`${filtered.length} events`}
          permission="Evidence review"
          detail="Known operators are separated from unknown crawler pressure for faster triage."
          operators={uniqueOperators.length ? uniqueOperators : ["OpenAI", "Anthropic", "Unknown crawler"]}
        />
        <article className="signatureWidget threatWidget">
          <span className="eyebrow">Threat events</span>
          <h2>{threatEvents.length}</h2>
          <p>{threatEvents.length ? "Review suspicious crawler activity and policy conflicts." : "No threat-class events in the current filtered view."}</p>
        </article>
        <article className="signatureWidget">
          <span className="eyebrow">Next action</span>
          <h2>{threatEvents.length ? "Review risk" : "Tune policies"}</h2>
          <p>Use activity evidence to adjust access rules without changing tracker ingestion behavior.</p>
          <RouteLink to="/control" className="textLink">
            Open governance
          </RouteLink>
        </article>
      </section>
    </AppShell>
  );
}
