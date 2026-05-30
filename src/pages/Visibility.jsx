import { useState } from "react";
import AppShell from "../components/AppShell.jsx";
import { AIVisibilityScore } from "../components/SignatureWidgets.jsx";
import { useApp } from "../context/AppContext.jsx";
import { RouteLink } from "../navigation.jsx";

export default function Visibility() {
  const { state, actions } = useApp();
  const [url, setUrl] = useState("https://northstar.media");

  const check = async () => {
    await actions.checkVisibility(url);
  };

  const result = state.visibility;
  const visibilityScore = result?.score ?? "Pending";
  const discoverableAssets = result?.suggestedQueries?.length || 0;
  const aiReadyAssets = result?.providers?.filter((provider) => Number(provider.score || 0) >= 70).length || 0;
  const directiveCoverage = result ? "Review ready" : "Not scanned";

  return (
    <AppShell
      title="AI Discoverability"
      eyebrow="Visibility"
      subtitle="Inspect citation readiness, crawler reach, structured content health, and AI readiness signals."
    >
      <section className="commandHero visibilityCommandHero" aria-label="AI visibility command summary">
        <div className="commandHeroCopy">
          <span className="eyebrow">AI discoverability intelligence</span>
          <h2>Measure how ready your assets are for AI retrieval.</h2>
          <p>Score discoverability, directives, structured content health, and citation readiness before tuning access rules.</p>
        </div>
        <div className="commandHeroMetrics visibilityScoreMetrics">
          <article className="visibilityScoreHero">
            <span>Visibility score</span>
            <strong>{visibilityScore}{typeof visibilityScore === "number" ? "%" : ""}</strong>
            <em>{result?.lastChecked || "Run a scan"}</em>
          </article>
          <article>
            <span>Discoverable assets</span>
            <strong>{discoverableAssets}</strong>
            <em>Query signals</em>
          </article>
          <article>
            <span>AI ready assets</span>
            <strong>{aiReadyAssets}</strong>
            <em>Provider scores above 70</em>
          </article>
          <article>
            <span>Directive coverage</span>
            <strong>{directiveCoverage}</strong>
            <em>robots + llms.txt posture</em>
          </article>
        </div>
      </section>
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
          <section className="signatureWidgetGrid visibilitySignatureGrid" aria-label="AI visibility score">
            <AIVisibilityScore
              score={result.score}
              discoverableAssets={discoverableAssets}
              directiveCoverage={directiveCoverage}
              aiReadiness={`${aiReadyAssets} ready providers`}
              detail="Visibility intelligence connects discoverability, provider checks, directives, and structured content signals."
            />
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
          <section className="visibilityReadinessGrid" aria-label="AI discoverability readiness">
            <article className="app-dark-card">
              <span>Directives status</span>
              <strong>robots.txt review</strong>
              <p>Use tracker evidence before changing public crawler instructions.</p>
            </article>
            <article className="app-dark-card">
              <span>llms.txt readiness</span>
              <strong>Documentation-ready</strong>
              <p>Prepare machine-readable guidance for approved agent access.</p>
            </article>
            <article className="app-dark-card">
              <span>Discoverable pages</span>
              <strong>{result.suggestedQueries?.length || 0} signals</strong>
              <p>Content structure and query patterns inform AI visibility checks.</p>
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
