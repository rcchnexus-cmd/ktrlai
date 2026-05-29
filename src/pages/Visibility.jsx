import { useState } from "react";
import AppShell from "../components/AppShell.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

export default function Visibility() {
  const { state, actions } = useApp();
  const [url, setUrl] = useState("https://northstar.media");

  const check = async () => {
    await actions.checkVisibility(url);
  };

  const result = state.visibility;

  return (
    <AppShell
      title="AI Visibility"
      eyebrow="Monitor"
      subtitle="Check how your content may be discovered, cited, or accessed by AI systems."
    >
      <section className="panel visibilityHero">
        <div>
          <span className="eyebrow">Check visibility</span>
          <h2>Inspect how AI systems discover your website.</h2>
          <p>Run a visibility scan across answer engines, crawlers, and retrieval patterns.</p>
        </div>
        <div className="urlCheck">
          <input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Website URL" />
          <button type="button" className="primaryButton" onClick={check} disabled={state.loading.visibility}>
            {state.loading.visibility ? "Checking..." : "Check Visibility"}
          </button>
        </div>
      </section>

      {!result && !state.loading.visibility && (
        <section className="emptyState">
          <strong>No visibility scan yet</strong>
          <p>Enter a domain and run a scan to inspect discovery, citation, and access signals.</p>
        </section>
      )}

      {result && (
        <>
          <section className={`dataModeNotice ${result.source || "empty"}`} aria-label="Visibility data status">
            <span>{result.sourceLabel || "Visibility preview"}</span>
            <span>{result.sourceDetail || "Visibility guidance is separated from live tracker analytics."}</span>
          </section>
          <section className="metricGrid">
            <article className="metricCard">
              <span>Visibility score</span>
              <strong>{result.score}%</strong>
              <em className="metricChange positive">{result.lastChecked}</em>
            </article>
            <article className="metricCard">
              <span>Domain</span>
              <strong>{result.url}</strong>
              <em className="metricChange neutral">Analyzed</em>
            </article>
          </section>
          <section className="providerGrid">
            {result.providers.map((provider) => (
              <article className="providerCard" key={provider.name}>
                <div>
                  <strong>{provider.name}</strong>
                  <span>{provider.status}</span>
                </div>
                <div className="scoreRing" style={{ "--score": `${provider.score}%` }}>
                  {provider.score}
                </div>
                <p>{provider.detail}</p>
              </article>
            ))}
          </section>
          <section className="panel twoColumnPanel">
            <div>
              <span className="eyebrow">Suggested queries</span>
              <h2>Test citation and retrieval patterns</h2>
              <div className="queryList">
                {result.suggestedQueries.map((query) => (
                  <span key={query}>
                    {query}
                  </span>
                ))}
              </div>
            </div>
            <div className="ctaPanel">
              <h3>Ready for policy control?</h3>
              <p>Enable policies for trusted bots, unknown crawlers, summaries, full content, and training rights.</p>
              <RouteLink to="/control" className="primaryButton smallButton">
                Enable control
              </RouteLink>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
