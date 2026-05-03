import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function Activity() {
  const { state, actions } = useApp();
  const [search, setSearch] = useState("");
  const [botType, setBotType] = useState("All");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState("All");

  useEffect(() => {
    if (state.activity.length === 0 && !state.loading.activity) {
      actions.loadActivity();
    }
  }, [actions, state.activity.length, state.loading.activity]);

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

  return (
    <AppShell title="AI Activity" eyebrow="Access logs">
      <section className="panel liveIngestionPanel">
        <div className="liveIngestionHeader">
          <div>
            <span className="eyebrow">Live ingestion</span>
            <h2>Tracker endpoint ready</h2>
          </div>
          <span className="liveIndicator">
            <i aria-hidden="true" />
            Mock live
          </span>
        </div>
        <p>Install the tracker script to start collecting AI access events.</p>
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
      {isInitialLoading ? (
        <div className="loadingState">Loading AI activity logs...</div>
      ) : (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Filtered logs</span>
              <h2>{filtered.length} AI events</h2>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="emptyState">
              <strong>No matching AI events</strong>
              <p>Try clearing your search or choosing a broader bot type, status, or date filter.</p>
            </div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Bot</th>
                    <th>Type</th>
                    <th>Page</th>
                    <th>Status</th>
                    <th>Region</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{row.bot}</td>
                      <td>{row.type}</td>
                      <td>{row.page}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{row.region}</td>
                      <td>
                        {row.date} {row.time}
                      </td>
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
