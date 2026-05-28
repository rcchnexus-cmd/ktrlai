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

const crawlControlFeatures = [
  ["Get started with KtrlAI", "Add a domain, generate a key, install the tracker, and confirm first crawler evidence.", "Setup workflow"],
  ["Monitor AI crawler activity", "Track AI requests, suspicious signals, top operators, and accessed paths.", "Traffic intelligence"],
  ["Manage AI crawlers", "Assign allow, monitor, restrict, or charge-ready states by crawler and operator.", "Governance policies"],
  ["Prepare monetization", "Model Pay Per Crawl-style readiness with pricing rules and payout checks.", "Beta readiness"],
  ["Configure directives", "Document robots.txt and llms.txt readiness while policies drive KtrlAI metadata.", "Agent resources"],
  ["Reference-ready platform", "Keep API, webhook, bot/operator, and install references close to operations.", "Developer tools"]
];

const workflowSteps = [
  ["01", "Detect request", "Capture crawler activity from verified sites."],
  ["02", "Identify operator", "Classify known AI systems and suspicious clients."],
  ["03", "Apply policy", "Attach allow, monitor, restrict, or charge-ready context."],
  ["04", "Record evidence", "Store an operational record for analytics and audit."],
  ["05", "Prepare licensing", "Use governed evidence to support future commercial workflows."]
];

const planTiers = [
  [
    "Free / Starter",
    "Validate crawler visibility before broad rollout.",
    ["Basic crawler detection", "Limited analytics window", "Monitor and restrict workflow"]
  ],
  [
    "Pro / Business",
    "Operate policy and intelligence across production content.",
    ["Longer analytics windows", "Operator intelligence", "Policy templates", "Monetization readiness"]
  ],
  [
    "Enterprise",
    "Govern AI access with team, audit, and integration readiness.",
    ["Advanced detection", "API access", "Team governance", "Audit exports", "Enforcement integrations readiness"]
  ]
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
          <a href="#capabilities">Capabilities</a>
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
      <div className="workflowCanvasStatus">
        <span>
          <i aria-hidden="true" />
          Live policy graph
        </span>
        <strong>Evidence recorded</strong>
      </div>
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
      <div className="workflowCanvasTelemetry">
        <span>128k AI requests</span>
        <span>18 policies active</span>
        <span>42 suspicious signals</span>
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

function CapabilityGrid() {
  return (
    <section className="n8nSection n8nCapabilitySection" id="capabilities">
      <div className="n8nSectionIntro">
        <span className="n8nEyebrow">Crawler control scope</span>
        <h2>From crawler visibility to governance readiness.</h2>
        <p>KtrlAI organizes setup, traffic intelligence, crawler management, directives, and future monetization workflows in one control plane.</p>
      </div>
      <div className="n8nCapabilityGrid">
        {crawlControlFeatures.map(([title, body, badge]) => (
          <article key={title}>
            <span>{badge}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>
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

function PlanComparison() {
  return (
    <section className="n8nSection n8nPlanSection" aria-label="KtrlAI plan comparison">
      <div className="n8nSectionIntro">
        <span className="n8nEyebrow">Plan paths</span>
        <h2>Start with visibility. Expand into governance.</h2>
        <p>Plan language stays honest: network-level blocking and Pay Per Crawl monetization are readiness workflows, not active enforcement claims.</p>
      </div>
      <div className="n8nPlanGrid">
        {planTiers.map(([title, body, features]) => (
          <article key={title}>
            <span>{title}</span>
            <p>{body}</p>
            <ul>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
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
              <div className="n8nHeroTelemetry" aria-label="Live KtrlAI telemetry">
                <span>
                  <i aria-hidden="true" />
                  Live tracker signal
                </span>
                <span>128k AI requests</span>
                <span>18 policies active</span>
                <span>Evidence recorded</span>
              </div>
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

          <section className="n8nSection n8nProductProofSection" id="product">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Product proof</span>
              <h2>Govern AI access with operational evidence.</h2>
              <p>Every crawler signal becomes policy context, analytics, and audit-ready workflow data.</p>
            </div>
            <div className="n8nProofGrid">
              {proofCards.map(([title, body, detail]) => (
                <article className={/Evidence stream|Policy engine/.test(title) ? "primaryProof" : ""} key={title}>
                  <span>{title}</span>
                  <strong>{detail}</strong>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <CapabilityGrid />

          <section className="n8nSection n8nWorkflowSection" id="governance">
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

          <section className="n8nSection n8nControlPreviewSection">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Control plane</span>
              <h2>Evidence, policy, and system health in one dashboard.</h2>
              <p>Designed for teams that need to understand AI traffic before they can govern or commercialize it.</p>
            </div>
            <DashboardPreview />
          </section>

          <PlanComparison />

          <section className="n8nFinalCta" id="pricing">
            <div className="n8nFinalCtaCopy">
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
            </div>
            <div className="n8nCtaProof" aria-label="KtrlAI proof signals">
              <span>Policy active</span>
              <div>
                <strong>PerplexityBot</strong>
                <em>/guides/api</em>
                <b>Restrict</b>
              </div>
              <div>
                <strong>ChatGPT-User</strong>
                <em>/pricing</em>
                <b>Monitor</b>
              </div>
              <div>
                <strong>ClaudeBot</strong>
                <em>/blog/licensing</em>
                <b>Allow</b>
              </div>
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
