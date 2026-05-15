import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell.jsx";
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
  const sourceDetail = activityMeta.sourceDetail || "Install the tracker script to start collecting AI access events.";
  const hasActivityRows = state.activity.length > 0;

  return (
    <AppShell title="Live AI Activity Stream" eyebrow="Monitor">
      <section className="panel liveIngestionPanel">
        <div className="liveIngestionHeader">
          <div>
            <span className="eyebrow">Live ingestion</span>
            <h2>{sourceLabel}</h2>
          </div>
          <StatusBadge status={sourceLabel} />
        </div>
        <p>{sourceDetail}</p>
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
          <strong>AI activity could not be loaded</strong>
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
              <span className="eyebrow">Event stream</span>
              <h2>{filtered.length} access events</h2>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="emptyState">
              <strong>{hasActivityRows ? "No matching AI events" : "No tracking data yet"}</strong>
              <p>
                {hasActivityRows
                  ? "Try clearing your search or choosing a broader bot type, status, or date filter."
                  : "Install your tracker script and generate a live event to start filling this log."}
              </p>
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
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Policy</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date} {row.time}</td>
                      <td>{row.bot}</td>
                      <td>{row.page}</td>
                      <td>{row.category || "Legacy"}</td>
                      <td>{getEventSeverity(row)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{row.confidenceScore ? `${row.confidenceScore}% confidence` : row.type}</td>
                      <td>{row.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
