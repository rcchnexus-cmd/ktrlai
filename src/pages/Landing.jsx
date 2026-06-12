import { useCallback, useEffect, useState } from "react";
import Logo from "../components/Logo.jsx";
import { RouteLink } from "../navigation.jsx";

const proofCards = [
  ["Crawler ledger", "Timestamped access with operator, path, action, and context.", "12:04 /pricing monitor"],
  ["Access rules", "Map AI operators to monitor, restrict, block-ready, or charge-ready workflows.", "18 active rules"],
  ["Operator intelligence", "Group activity by OpenAI, Perplexity, Anthropic, Google, and unknown scrapers.", "4 top operators"],
  ["Traffic analysis", "Summarize AI share, suspicious pressure, top paths, and outcomes.", "128k AI requests"],
  ["Licensing prep", "Keep access trails that support future commercial AI discussions.", "3.8k paths tracked"],
  ["Audit trail", "Record workspace changes, API key events, and security activity.", "7d activity log"]
];

const crawlControlFeatures = [
  ["Get started with KtrlAI", "Add a domain, generate a key, install the tracker, and confirm first crawler evidence.", "Setup workflow"],
  ["Monitor AI crawler activity", "Track AI requests, suspicious signals, top operators, and accessed paths.", "Traffic intelligence"],
  ["Manage AI crawlers", "Assign allow, monitor, restrict, or charge-ready states by crawler and operator.", "Crawler controls"],
  ["Prepare monetization", "Model Pay Per Crawl-style readiness with pricing rules and payout checks.", "Beta readiness"],
  ["Configure directives", "Document robots.txt and llms.txt readiness while policies drive KtrlAI metadata.", "Agent resources"],
  ["Reference-ready platform", "Keep API, webhook, bot/operator, and install references close to operations.", "Developer tools"]
];

const whyNowCards = [
  ["AI visibility", "Understand which AI systems access your content."],
  ["Governance readiness", "Prepare operational policy workflows for AI access."],
  ["Evidence infrastructure", "Maintain audit-ready records of crawler activity."],
  ["Monetization readiness", "Prepare future licensing and commercial AI workflows."]
];

const workflowSteps = [
  ["01", "Detect request", "Capture crawler activity from verified sites."],
  ["02", "Identify operator", "Classify known AI systems and suspicious clients."],
  ["03", "Apply rule", "Attach allow, monitor, restrict, or charge-ready context."],
  ["04", "Record event", "Store an operational record for analytics and audit."],
  ["05", "Prepare terms", "Use access records to support future commercial workflows."]
];

const policyExamples = [
  ["Training access", "Restrict"],
  ["Citation access", "Allow"],
  ["Premium docs", "Monitor"],
  ["API ingestion", "Review"]
];

const trustSetupDetails = [
  "Setup in minutes",
  "Metadata-first tracking",
  "Audit-ready logs",
  "Workflow metadata today"
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
    "Run team access, audit, and integration workflows.",
    ["Advanced detection", "API access", "Team governance", "Audit exports", "Enforcement integrations readiness"]
  ]
];

const useCases = [
  ["Publishers", "Control AI crawler access to articles, archives, and premium pages."],
  ["SEO teams", "Track AI visibility and understand crawler behavior across content."],
  ["SaaS teams", "Manage docs, changelog, and developer content ingestion."],
  ["Enterprise teams", "Audit AI access across domains, policies, and workspaces."]
];

function GlassNav() {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    document.body.classList.toggle("landingDrawerOpen", isOpen);

    return () => document.body.classList.remove("landingDrawerOpen");
  }, [isOpen]);

  return (
    <header className="n8nLandingNavWrap">
      <nav className={isOpen ? "n8nLandingNav menuOpen" : "n8nLandingNav"} aria-label="KtrlAI public navigation">
        <Logo />
        <button
          type="button"
          className="n8nMobileMenuButton"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="landing-navigation-drawer"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
        <button
          type="button"
          className={isOpen ? "n8nLandingNavScrim visible" : "n8nLandingNavScrim"}
          aria-label="Close navigation menu"
          onClick={closeMenu}
        />
        <div
          className={isOpen ? "n8nLandingNavDrawer open" : "n8nLandingNavDrawer"}
          id="landing-navigation-drawer"
        >
          <div className="n8nLandingDrawerHeader">
            <Logo linked={false} />
            <button type="button" className="n8nLandingDrawerClose" aria-label="Close navigation menu" onClick={closeMenu}>
              <span />
              <span />
            </button>
          </div>
          <div className="n8nLandingNavLinks">
            <a href="#product" onClick={closeMenu}>Product</a>
            <a href="#capabilities" onClick={closeMenu}>Capabilities</a>
            <a href="#use-cases" onClick={closeMenu}>Use cases</a>
            <RouteLink to="/docs" onClick={closeMenu}>Docs</RouteLink>
            <a href="#governance" onClick={closeMenu}>Governance</a>
            <a href="#pricing" onClick={closeMenu}>Pricing</a>
          </div>
          <div className="n8nLandingNavActions">
            <RouteLink to="/login" onClick={closeMenu}>Sign in</RouteLink>
            <RouteLink to="/signup" className="n8nGradientButton" onClick={closeMenu}>
              Get Started
            </RouteLink>
          </div>
        </div>
      </nav>
    </header>
  );
}

function WorkflowCanvas() {
  return (
    <div className="workflowVisual">
      <aside className="workflowCanvas workflowCanvasDesktop" aria-label="AI access workflow preview">
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

      <aside className="workflowCanvasMobile" aria-label="AI access workflow preview">
        <div className="mobileWorkflowStatus">
          <span><i aria-hidden="true" /> Receiving signals</span>
          <strong>Evidence recorded</strong>
        </div>
        <div className="mobileWorkflowNode">
          <span>Website event</span>
          <strong>/docs/api</strong>
          <em>GET request received</em>
        </div>
        <div className="mobileWorkflowArrow" aria-hidden="true">↓</div>
        <div className="mobileWorkflowNode engine">
          <span>Policy engine</span>
          <strong>Classify + govern</strong>
          <em>Workspace rules applied</em>
        </div>
        <div className="mobileWorkflowArrow" aria-hidden="true">↓</div>
        <div className="mobileWorkflowNode">
          <span>Decision</span>
          <strong>Training access restricted</strong>
          <em>Policy confidence: high</em>
        </div>
        <div className="mobileWorkflowArrow" aria-hidden="true">↓</div>
        <div className="mobileWorkflowNode">
          <span>Action</span>
          <strong>Monitor + retain evidence</strong>
          <em>Operator flagged for review</em>
        </div>
        <div className="mobileWorkflowArrow" aria-hidden="true">↓</div>
        <div className="mobileWorkflowNode">
          <span>Operator</span>
          <div className="mobileOperatorCluster">
            <b>OpenAI</b>
            <b>Perplexity</b>
            <b>Claude</b>
            <b>Gemini</b>
          </div>
        </div>
        <div className="mobileWorkflowArrow" aria-hidden="true">↓</div>
        <div className="mobileWorkflowNode outcome">
          <span>Outcome</span>
          <strong>Evidence stored</strong>
          <em>Analytics and workflow updated</em>
        </div>
      </aside>
    </div>
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

function WhyNowSection() {
  return (
    <section className="n8nSection n8nWhyNowSection" aria-label="Why KtrlAI matters now">
      <div className="n8nWhyNowLayout">
        <div className="n8nSectionIntro">
          <span className="n8nEyebrow">Why this matters now</span>
          <h2 className="landing-section-title-md">AI systems are already accessing the open web.</h2>
          <p>
            KtrlAI helps website owners understand AI crawler activity, preserve evidence, and prepare governance workflows before AI access becomes standard commercial infrastructure.
          </p>
        </div>
        <div className="n8nWhyNowCards">
          {whyNowCards.map(([title, body]) => (
            <article key={title}>
              <span aria-hidden="true" />
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilityGrid() {
  return (
    <section className="n8nSection n8nCapabilitySection" id="capabilities">
      <div className="n8nSectionIntro">
        <span className="n8nEyebrow">Crawler control scope</span>
        <h2 className="landing-section-title-md">From crawler visibility to operating workflows.</h2>
        <p>KtrlAI organizes setup, traffic analysis, crawler management, directives, and future monetization workflows in one control plane.</p>
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

function PolicyExamples() {
  return (
    <div className="n8nPolicyExamples" aria-label="Governance policy examples">
      <span className="n8nEyebrow">Policy examples</span>
      <div>
        {policyExamples.map(([label, action]) => (
          <article key={label}>
            <strong>{label}</strong>
            <em>{action}</em>
          </article>
        ))}
      </div>
    </div>
  );
}

function TrustSetupStrip() {
  return (
    <section className="n8nTrustSetupStrip" aria-label="KtrlAI setup and enforcement clarity">
      <div>
        {trustSetupDetails.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <p>Network-level blocking is not enabled yet. Policies currently drive visibility, workflow, and tracker metadata.</p>
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
        <h2 className="landing-section-title-sm">Start with visibility. Expand into controls.</h2>
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
                Monitor AI crawlers, route access decisions, and manage how AI systems interact with your website.
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

          <WhyNowSection />

          <section className="n8nSection n8nProductProofSection" id="product">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Product proof</span>
              <h2 className="landing-section-title-xl">Turn crawler signals into operating data.</h2>
              <p>Every request becomes analytics, access context, and audit-ready workflow data.</p>
            </div>
            <div className="n8nProofGrid">
              {proofCards.map(([title, body, detail]) => (
                <article className={/Crawler ledger|Access rules/.test(title) ? "primaryProof" : ""} key={title}>
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
              <h2 className="landing-section-title-md">From crawler signal to access decision.</h2>
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
            <PolicyExamples />
          </section>

          <TrustSetupStrip />

          <section className="n8nSection n8nControlPreviewSection">
            <div className="n8nSectionIntro">
              <span className="n8nEyebrow">Control plane</span>
              <h2 className="landing-section-title-md">Access records, rules, and system health in one dashboard.</h2>
              <p>Designed for teams that need to understand AI traffic before they can manage or commercialize it.</p>
            </div>
            <DashboardPreview />
          </section>

          <PlanComparison />

          <section className="n8nFinalCta" id="pricing">
            <div className="n8nFinalCtaCopy">
              <span className="n8nEyebrow">Private beta</span>
              <h2>Start governing AI access.</h2>
              <p>Install the tracker, validate crawler activity, and prepare your content operations for managed AI access.</p>
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
