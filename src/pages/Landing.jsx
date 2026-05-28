import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import { RouteLink } from "../navigation.jsx";

const evidenceRows = [
  ["ChatGPT-User", "/pricing", "Monitor"],
  ["PerplexityBot", "/guides/api", "Restrict"],
  ["ClaudeBot", "/blog/licensing", "Allow"]
];

const problemCards = [
  ["Unknown crawler activity", "AI systems can access valuable public content without a clean operating record.", "warning"],
  ["No policy layer", "Website teams need crawler rules that map to AI summaries, training, and usage intent.", "policy"],
  ["Limited AI referral insight", "AI visibility is difficult to measure when crawler evidence and content outcomes are separate.", "intelligence"],
  ["Licensing readiness gap", "Commercial AI access requires reliable evidence before terms can be negotiated.", "revenue"]
];

const solutionCards = [
  ["Detect AI crawlers", "Classify AI, search, browser, and suspicious access patterns from live site activity."],
  ["Review accessed pages", "Understand which paths AI systems touch, how often, and under what policy context."],
  ["Set governance policies", "Apply allow, monitor, restrict, block-ready, and charge-ready states across crawler scopes."],
  ["Prepare licensing workflows", "Keep policy-aware records that support reporting, negotiation, and monetization readiness."]
];

const workflowSteps = [
  ["01", "Install tracker", "Add the lightweight SDK to verified domains and start capturing evidence."],
  ["02", "Detect AI crawlers", "Identify known AI operators, search crawlers, browsers, and suspicious scrapers."],
  ["03", "Govern access", "Map crawler scopes to policy states without changing network behavior yet."],
  ["04", "Review intelligence", "Use dashboards, streams, and rollups to understand AI access over time."]
];

const productProofCards = [
  ["Evidence stream", "Timestamped crawler activity with operator, path, status, risk, and policy context.", "12:04 ChatGPT-User /pricing"],
  ["Policy control", "Governance states turn crawler activity into operational workflow metadata.", "Monitor / Restrict / Charge-ready"],
  ["Traffic intelligence", "Rollup-ready analytics summarize operators, paths, AI share, and suspicious pressure.", "76% AI assistant traffic"],
  ["Licensing readiness", "Usage evidence prepares content teams for commercial AI access discussions.", "3.8k governed paths"],
  ["System health", "Tracker, ingestion, queues, rollups, notifications, and rate limits surface operating state.", "Ingestion healthy"],
  ["API key security", "Workspace keys are generated once, hashed server-side, and masked after refresh.", "ktrl_live_masked"]
];

const trustSignals = [
  "API keys",
  "Audit logs",
  "Rate limits",
  "Rollup analytics",
  "Notifications",
  "Jobs/queues",
  "Governance policies"
];

function SectionIntro({ eyebrow, title, body }) {
  return (
    <div className="landing-section-intro">
      <span className="kt-eyebrow">{eyebrow}</span>
      <h2 className="kt-section-title">{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function ControlPlaneVisual() {
  return (
    <aside className="kt-proof-card landing-control-plane" aria-label="KtrlAI control plane preview">
      <div className="landing-proof-header">
        <div>
          <span className="kt-eyebrow">Control plane</span>
          <strong>docs.company.com</strong>
        </div>
        <span className="kt-status-pill status-active">Tracking active</span>
      </div>

      <div className="landing-operator-row" aria-label="AI operators">
        <span>OpenAI</span>
        <span>Perplexity</span>
        <span>Anthropic</span>
        <span>Google</span>
      </div>

      <div className="kt-grid-3 landing-proof-metrics">
        <article>
          <span>AI requests</span>
          <strong>128k</strong>
        </article>
        <article>
          <span>Policies</span>
          <strong>18</strong>
        </article>
        <article>
          <span>Suspicious</span>
          <strong>42</strong>
        </article>
      </div>

      <div className="landing-evidence-table" aria-label="Recent evidence rows">
        <div className="landing-evidence-head">
          <span>Operator</span>
          <span>Path</span>
          <span>Policy</span>
        </div>
        {evidenceRows.map(([operator, path, policy]) => (
          <div className="landing-evidence-row" key={`${operator}-${path}`}>
            <strong>{operator}</strong>
            <code>{path}</code>
            <span>{policy}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function Landing() {
  return (
    <div className="site landing-page">
      <MarketingNav />

      <main>
        <section className="kt-section landing-hero">
          <div className="kt-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="kt-eyebrow">AI access governance infrastructure</span>
              <h1 className="kt-hero-title">Control how AI systems access your website.</h1>
              <p className="landing-hero-lead">
                Monitor AI crawlers, enforce governance policies, and measure AI visibility from one control plane.
              </p>
              <p className="landing-hero-note">
                Built for publishers, SaaS teams, SEO operators, and content platforms preparing for the AI-driven web.
              </p>
              <div className="landing-hero-actions">
                <RouteLink to="/signup" className="kt-btn kt-btn-primary">
                  Start free
                </RouteLink>
                <RouteLink to="#product" className="kt-btn kt-btn-secondary">
                  View product
                </RouteLink>
              </div>
            </div>
            <ControlPlaneVisual />
          </div>
        </section>

        <section className="kt-section">
          <div className="kt-container">
            <div className="kt-audience-section-final">
              <div className="kt-eyebrow">
                Built for operators of the open web
              </div>

              <div className="kt-audience-grid-final">
                <div className="kt-audience-chip-final">Publishers</div>
                <div className="kt-audience-chip-final">SEO agencies</div>
                <div className="kt-audience-chip-final">SaaS companies</div>
                <div className="kt-audience-chip-final">Content platforms</div>
                <div className="kt-audience-chip-final">Enterprise teams</div>
              </div>
            </div>
          </div>
        </section>

        <section className="kt-section" id="problem">
          <div className="kt-container">
            <SectionIntro
              eyebrow="Problem"
              title="AI systems are accessing websites without clear visibility."
              body="Open web operators need a reliable way to see crawler activity, understand accessed content, and prepare for policy and licensing decisions."
            />
            <div className="kt-grid-4 landing-card-grid">
              {problemCards.map(([title, body, tone]) => (
                <article className="kt-card landing-feature-card" key={title}>
                  <span className={`landing-card-accent ${tone}`} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kt-section landing-soft-section" id="solution">
          <div className="kt-container">
            <SectionIntro
              eyebrow="Solution"
              title="Visibility and governance for AI access."
              body="KtrlAI turns AI crawler activity into evidence, policies, traffic intelligence, and licensing readiness workflows."
            />
            <div className="kt-grid-4 landing-card-grid">
              {solutionCards.map(([title, body]) => (
                <article className="kt-card landing-feature-card" key={title}>
                  <span className="landing-card-index" aria-hidden="true">
                    0{solutionCards.findIndex(([item]) => item === title) + 1}
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kt-section" id="how-it-works">
          <div className="kt-container">
            <SectionIntro
              eyebrow="How it works"
              title="From tracker install to governed intelligence."
              body="Four operational steps move your site from unknown AI access to measurable, policy-aware crawler evidence."
            />
            <div className="kt-grid-4 landing-workflow">
              {workflowSteps.map(([step, title, body]) => (
                <article className="kt-card-compact landing-workflow-card" key={title}>
                  <span>{step}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kt-section landing-product-section" id="product">
          <div className="kt-container">
            <SectionIntro
              eyebrow="Product proof"
              title="Operational controls for AI access decisions."
              body="KtrlAI gives teams a shared evidence layer for crawler visibility, governance state, analytics, system health, and API key security."
            />
            <div className="kt-grid-3 landing-proof-grid">
              {productProofCards.map(([title, body, detail]) => (
                <article className="kt-card landing-proof-card" key={title}>
                  <span className="kt-eyebrow">{title}</span>
                  <strong>{detail}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kt-section landing-trust-section" aria-label="Infrastructure trust">
          <div className="kt-container landing-trust-panel">
            <div>
              <span className="kt-eyebrow">Infrastructure trust</span>
              <h2 className="kt-section-title">Built for crawler governance operations.</h2>
            </div>
            <div className="landing-trust-list">
              {trustSignals.map((signal) => (
                <span className="kt-status-pill" key={signal}>
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="kt-section" id="pricing">
          <div className="kt-container landing-beta-cta">
            <span className="kt-eyebrow">Private beta</span>
            <h2 className="kt-section-title">Start with AI visibility. Grow into governance.</h2>
            <p>
              Install the tracker, validate AI crawler activity, and prepare your content operations for AI access control.
            </p>
            <div>
              <RouteLink to="/signup" className="kt-btn kt-btn-primary">
                Start free
              </RouteLink>
              <RouteLink to="/contact" className="kt-btn kt-btn-secondary">
                Request private beta
              </RouteLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
