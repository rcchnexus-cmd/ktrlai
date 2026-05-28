import Logo from "../components/Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const proofCards = [
  ["Evidence stream", "Timestamped crawler access with operator, path, action, and policy context.", "12:04 /pricing monitor"],
  ["Policy engine", "Map AI operators to monitor, restrict, block-ready, or charge-ready workflows.", "18 active policies"],
  ["Operator intelligence", "Group activity by OpenAI, Perplexity, Anthropic, Google, and unknown scrapers.", "4 top operators"],
  ["Traffic intelligence", "Summarize AI share, suspicious pressure, top paths, and governance outcomes.", "128k AI requests"],
  ["Licensing readiness", "Keep evidence trails that support future commercial AI access discussions.", "3.8k governed paths"],
  ["Audit trail", "Record policy updates, workspace changes, API key events, and security activity.", "7d activity log"]
];

const workflowSteps = [
  ["01", "Detect request", "Capture crawler activity from verified sites."],
  ["02", "Identify operator", "Classify known AI systems and suspicious clients."],
  ["03", "Apply policy", "Attach allow, monitor, restrict, or charge-ready context."],
  ["04", "Record evidence", "Store an operational record for analytics and audit."],
  ["05", "Prepare licensing", "Use governed evidence to support future commercial workflows."]
];

const useCases = [
  ["Publishers", "Control AI crawler access to articles, archives, and premium pages."],
  ["SEO teams", "Track AI visibility and understand crawler behavior across content."],
  ["SaaS teams", "Govern docs, changelog, and developer content ingestion."],
  ["Enterprise teams", "Audit AI access across domains, policies, and workspaces."]
];

function GlassNav() {
  return (
    <header className="n8nLandingNavWrap">
      <nav className="n8nLandingNav" aria-label="KtrlAI public navigation">
        <Logo />
        <div className="n8nLandingNavLinks">
          <a href="#product">Product</a>
          <a href="#use-cases">Use cases</a>
          <RouteLink to="/docs">Docs</RouteLink>
          <a href="#governance">Governance</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="n8nLandingNavActions">
          <RouteLink to="/login">Sign in</RouteLink>
          <RouteLink to="/signup" className="n8nGradientButton">
            Get Started
          </RouteLink>
        </div>
      </nav>
    </header>
  );
}

function WorkflowCanvas() {
  return (
    <aside className="workflowCanvas" aria-label="AI access workflow preview">
      <div className="workflowNode source">
        <span>Website event</span>
        <strong>/docs/api</strong>
        <em>GET request</em>
      </div>
      <div className="workflowLine horizontal" />
      <div className="workflowNode engine">
        <span>KtrlAI policy engine</span>
        <strong>Classify + govern</strong>
        <em>workspace policy context</em>
      </div>
      <div className="workflowLine horizontal second" />
      <div className="workflowNode decision">
        <span>Decision</span>
        <strong>Training allowed?</strong>
        <em>policy: restrict</em>
      </div>
      <div className="workflowBranch branchOne" />
      <div className="workflowBranch branchTwo" />
      <div className="workflowNode monitor">
        <span>Branch A</span>
        <strong>Monitor</strong>
        <em>record evidence</em>
      </div>
      <div className="workflowNode restrict">
        <span>Branch B</span>
        <strong>Restrict</strong>
        <em>flag operator</em>
      </div>
      <div className="operatorOrbit">
        <span>OpenAI</span>
        <span>Perplexity</span>
        <span>Claude</span>
        <span>Gemini</span>
      </div>
    </aside>
  );
}

function UseCaseRail() {
  return (
    <section className="n8nUseCaseRail" id="use-cases" aria-label="KtrlAI use cases">
      {useCases.map(([title, body], index) => (
        <article className={index === 0 ? "active" : ""} key={title}>
          <span>0{index + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="darkDashboardPreview" aria-label="KtrlAI dashboard preview">
      <div className="darkPreviewHeader">
        <div>
          <span>Operations</span>
          <strong>AI traffic control room</strong>
        </div>
        <em>Live governance</em>
      </div>
      <div className="darkPreviewMetrics">
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
      <div className="darkPreviewGrid">
        <div className="darkPreviewStream">
          <span>Evidence stream</span>
          <div>
            <strong>ChatGPT-User</strong>
            <code>/pricing</code>
            <em>Monitor</em>
          </div>
          <div>
            <strong>PerplexityBot</strong>
            <code>/guides/api</code>
            <em>Restrict</em>
          </div>
          <div>
            <strong>ClaudeBot</strong>
            <code>/blog/licensing</code>
            <em>Allow</em>
          </div>
        </div>
        <div className="darkPolicyMatrix">
          <span>Policy matrix</span>
          <p>OpenAI <strong>Monitor</strong></p>
          <p>Perplexity <strong>Restrict</strong></p>
          <p>Unknown scraper <strong>Review</strong></p>
        </div>
        <div className="darkSystemHealth">
          <span>System health</span>
          <p>Ingestion <strong>Healthy</strong></p>
          <p>Rollups <strong>Ready</strong></p>
          <p>Audit logs <strong>Active</strong></p>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="n8nLandingPage">
      <GlassNav />

      <main>
        <section className="n8nHeroSection">
          <div className="n8nHeroGrid">
            <div className="n8nHeroCopy">
              <span className="n8nEyebrow">AI access governance infrastructure</span>
              <h1>
                AI access workflows you can <span>see and control.</span>
              </h1>
              <p>
                Monitor AI crawlers, route policy decisions, and govern how AI systems interact with your website.
              </p>
              <div className="n8nHeroActions">
                <RouteLink to="/signup" className="n8nGradientButton large">
                  Get started for free
                </RouteLink>
                <RouteLink to="/contact" className="n8nGhostButton">
                  Talk to us
                </RouteLink>
              </div>
            </div>
            <WorkflowCanvas />
          </div>
        </section>

        <div className="n8nLandingContainer">
          <UseCaseRail />

          <section className="n8nSection" id="product">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Product proof</span>
              <h2>Govern AI access with operational evidence.</h2>
              <p>Every crawler signal becomes policy context, analytics, and audit-ready workflow data.</p>
            </div>
            <div className="n8nProofGrid">
              {proofCards.map(([title, body, detail]) => (
                <article key={title}>
                  <span>{title}</span>
                  <strong>{detail}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="n8nSection" id="governance">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Workflow</span>
              <h2>From crawler signal to governance action.</h2>
            </div>
            <div className="n8nWorkflowSteps">
              {workflowSteps.map(([step, title, body]) => (
                <article key={title}>
                  <span>{step}</span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="n8nSection">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Control plane</span>
              <h2>Evidence, policy, and system health in one dashboard.</h2>
              <p>Designed for teams that need to understand AI traffic before they can govern or commercialize it.</p>
            </div>
            <DashboardPreview />
          </section>

          <section className="n8nFinalCta" id="pricing">
            <span className="n8nEyebrow">Private beta</span>
            <h2>Start governing AI access.</h2>
            <p>Install the tracker, validate AI crawler activity, and prepare your content operations for governed access.</p>
            <div>
              <RouteLink to="/signup" className="n8nGradientButton large">
                Get Started
              </RouteLink>
              <RouteLink to="/contact" className="n8nGhostButton">
                Request Access
              </RouteLink>
            </div>
          </section>
        </div>
      </main>

      <footer className="n8nLandingFooter">
        <Logo linked={false} />
        <p>AI access governance infrastructure for the open web.</p>
        <nav aria-label="Footer navigation">
          <RouteLink to="/docs">Docs</RouteLink>
          <RouteLink to="/security">Security</RouteLink>
          <RouteLink to="/privacy">Privacy</RouteLink>
          <RouteLink to="/terms">Terms</RouteLink>
        </nav>
      </footer>
    </div>
  );
}
