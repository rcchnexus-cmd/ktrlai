import { useEffect, useState } from "react";
import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import { RouteLink } from "../navigation.jsx";
import { DistributionChart, TrafficChart } from "../components/Charts.jsx";
import { billingPlans, normalizePlan } from "../billing/stripeConfig.js";
import { openBillingPortal, startBillingCheckout } from "../billing/billingApi.js";
import { useApp } from "../context/AppContext.jsx";

const trust = ["Verified bot intelligence", "Dataset licensing", "AI crawler controls", "Source visibility"];
const teams = ["Northstar", "Atlas Labs", "SignalPress", "HelioData", "Orbital Cloud"];

const features = [
  ["signal", "AI access intelligence", "See which AI systems read, summarize, cite, or train on your content."],
  ["shield", "Policy enforcement", "Set rules for trusted bots, unknown crawlers, summary access, and training use."],
  ["revenue", "Monetization rails", "Turn permitted AI access into crawl fees, dataset licenses, and partner revenue."],
  ["training", "Training governance", "Choose which documents, style signals, and personalization layers models may use."],
  ["audit", "Audit-ready logs", "Keep a clean record of bot identity, pages accessed, policy result, and value created."],
  ["install", "Fast installation", "Drop in the tracker script, verify domains, and start seeing AI activity in minutes."]
];

function FeatureGlyph({ type }) {
  const paths = {
    signal: "M4 12H6M8 12H10M12 12H14M5 9C5 6.8 6.8 5 9 5C11.2 5 13 6.8 13 9M3 9C3 5.7 5.7 3 9 3C12.3 3 15 5.7 15 9",
    shield: "M9 3L14 5V8.5C14 11.4 12 14 9 15C6 14 4 11.4 4 8.5V5L9 3Z",
    revenue: "M5 11C5 12.7 6.8 14 9 14C11.2 14 13 12.7 13 11C13 9.3 11.2 8 9 8C6.8 8 5 6.7 5 5C5 3.3 6.8 2 9 2C11.2 2 13 3.3 13 5M9 1V15",
    training: "M3 5L9 2L15 5L9 8L3 5ZM5 7V11L9 13L13 11V7",
    audit: "M5 3H13V15H5V3ZM7 6H11M7 9H11M7 12H10M3 5H5",
    install: "M9 2V10M6 7L9 10L12 7M4 14H14"
  };

  return (
    <span className="featureIcon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function DashboardPreview() {
  const traffic = [
    { label: "Mon", value: 30 },
    { label: "Tue", value: 48 },
    { label: "Wed", value: 42 },
    { label: "Thu", value: 72 },
    { label: "Fri", value: 86 },
    { label: "Sat", value: 65 }
  ];

  const distribution = [
    { label: "Answer engines", value: 38, color: "#5B8CFF" },
    { label: "Training crawlers", value: 24, color: "#9B6DFF" },
    { label: "Search AI", value: 22, color: "#4ADE80" }
  ];

  const previewActivity = [
    ["ChatGPT-User", "Allowed", "18.4k"],
    ["PerplexityBot", "Summary", "9.2k"],
    ["ClaudeBot", "Blocked", "0"]
  ];

  return (
    <div className="heroMockup" aria-label="KtrlAI dashboard preview">
      <div className="mockupChrome">
        <span />
        <span />
        <span />
      </div>
      <div className="mockupBody">
        <div className="mockupSidebar">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="mockupContent">
          <div className="mockupHeader">
            <div>
              <span>AI visibility score</span>
              <strong>94%</strong>
            </div>
            <em>Live</em>
          </div>
          <div className="mockupGrid">
            <article>
              <span>Total AI visits</span>
              <strong>128k</strong>
            </article>
            <article>
              <span>Revenue</span>
              <strong>$24.8k</strong>
            </article>
            <article>
              <span>Trusted bots</span>
              <strong>42</strong>
            </article>
          </div>
          <div className="mockupPanels">
            <div className="mockupChartPanel">
              <div className="mockupPanelHeader">
                <strong>AI traffic</strong>
                <span>7d</span>
              </div>
              <TrafficChart data={traffic} />
            </div>
            <div className="mockupSidePanel">
              <div className="mockupPanelHeader">
                <strong>Access mix</strong>
                <span>Live</span>
              </div>
              <DistributionChart data={distribution} />
            </div>
          </div>
          <div className="mockupActivity">
            {previewActivity.map(([botName, status, tokens]) => (
              <div key={botName}>
                <span>{botName}</span>
                <strong>{status}</strong>
                <em>{tokens}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { state } = useApp();
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoadingPlan, setBillingLoadingPlan] = useState("");
  const currentPlan = state.auth.user?.plan || "Free";
  const normalizedCurrentPlan = normalizePlan(currentPlan);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const targets = Array.from(document.querySelectorAll("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  const handlePlanSelect = async (planKey) => {
    setBillingMessage("");
    setBillingLoadingPlan(planKey);

    const result = await startBillingCheckout({
      planKey,
      user: state.auth.user,
      workspaceId: "mock_workspace"
    });

    setBillingMessage(result.message || "");
    setBillingLoadingPlan("");
  };

  const handleManageBilling = async () => {
    const result = await openBillingPortal();
    setBillingMessage(result.message || "");
  };

  return (
    <div className="site">
      <MarketingNav />
      <main>
        <section className="heroSection" data-reveal>
          <div className="heroCopy">
            <div className="heroPill">Control layer for AI access, training, and monetization</div>
            <h1>AI is using your content. You just don't see it.</h1>
            <p>
              KtrlAI gives you visibility, control, and monetization over how AI systems interact with your data.
            </p>
            <div className="heroActions">
              <RouteLink to="/visibility" className="primaryButton heroPrimaryCta">
                Check My Site Free
              </RouteLink>
              <RouteLink to="/dashboard" className="secondaryButton">
                View Dashboard
              </RouteLink>
            </div>
          </div>
          <DashboardPreview />
        </section>

        <section className="authorityStrip" aria-label="Trusted by modern teams" data-reveal>
          <span>Trusted by modern teams</span>
          <div>
            {teams.map((team, index) => (
              <strong key={team} data-reveal style={{ "--reveal-index": index }}>
                {team}
              </strong>
            ))}
          </div>
        </section>

        <section className="trustStrip" aria-label="Trusted product capabilities" data-reveal>
          {trust.map((item, index) => (
            <span key={item} data-reveal style={{ "--reveal-index": index }}>
              {item}
            </span>
          ))}
        </section>

        <section className="section twoColumn" data-reveal>
          <div>
            <span className="eyebrow">The problem</span>
            <h2>AI traffic is becoming a business channel without a control plane.</h2>
          </div>
          <div className="stackedCopy">
            <p>
              AI systems crawl, summarize, cite, cache, and train on public content, often without clean visibility into
              identity, intent, or economic value.
            </p>
            <p>
              Robots files were designed for search-era crawlers. KtrlAI gives modern teams the policy, telemetry, and
              licensing surface they need for AI-era distribution.
            </p>
          </div>
        </section>

        <section className="section solutionBand" data-reveal>
          <span className="eyebrow">The solution</span>
          <h2>Observe every AI touchpoint, decide what is allowed, and capture value when models use your work.</h2>
          <div className="workflow">
            {["Detect", "Classify", "Control", "Price", "Audit"].map((step, index) => (
              <article key={step} data-reveal style={{ "--reveal-index": index }}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
                <p>
                  {step === "Detect" && "Identify AI systems accessing your domains in real time."}
                  {step === "Classify" && "Understand whether activity is search, answer, training, or unknown."}
                  {step === "Control" && "Apply granular policies by bot, page type, dataset, or access depth."}
                  {step === "Price" && "Attach crawl, summary, and dataset licensing terms to approved usage."}
                  {step === "Audit" && "Export clean logs for governance, compliance, and revenue operations."}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" data-reveal>
          <div className="sectionHeader">
            <span className="eyebrow">Platform</span>
            <h2>Everything content owners need to manage AI access.</h2>
          </div>
          <div className="featureGrid">
            {features.map(([icon, title, body], index) => (
              <article className="featureCard" key={title} data-reveal style={{ "--reveal-index": index }}>
                <FeatureGlyph type={icon} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section productPreview" data-reveal>
          <div>
            <span className="eyebrow">Product preview</span>
            <h2>A command center for the AI-driven internet.</h2>
            <p>
              KtrlAI connects AI visibility, control policies, usage analytics, training permissions, and revenue
              settings in one operating surface.
            </p>
            <RouteLink to="/dashboard" className="secondaryButton">
              Explore the app
            </RouteLink>
          </div>
          <div className="previewMatrix">
            <article data-reveal style={{ "--reveal-index": 0 }}>
              <strong>42</strong>
              <span>verified AI bots</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 1 }}>
              <strong>3.8k</strong>
              <span>pages governed</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 2 }}>
              <strong>$24.8k</strong>
              <span>AI revenue</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 3 }}>
              <strong>99.9%</strong>
              <span>policy uptime</span>
            </article>
          </div>
        </section>

        <section className="section twoColumn" data-reveal>
          <div>
            <span className="eyebrow">AI governance workflow</span>
            <h2>Move from passive crawl logs to enforceable AI data governance.</h2>
          </div>
          <div className="checkList">
            <span data-reveal style={{ "--reveal-index": 0 }}>Map AI systems to verified identities.</span>
            <span data-reveal style={{ "--reveal-index": 1 }}>Separate search visibility from training access.</span>
            <span data-reveal style={{ "--reveal-index": 2 }}>Apply summary-only, paywalled, or blocked outcomes.</span>
            <span data-reveal style={{ "--reveal-index": 3 }}>Keep policy history for legal, security, and commercial teams.</span>
          </div>
        </section>

        <section className="section splitBand" data-reveal>
          <article data-reveal style={{ "--reveal-index": 0 }}>
            <span className="eyebrow">Monetization</span>
            <h2>Turn AI demand into a revenue line.</h2>
            <p>
              Configure paid access for crawler usage, answer summaries, and dataset licensing. Model projected revenue
              before turning on enforcement.
            </p>
            <RouteLink to="/monetization" className="primaryButton smallButton">
              Enable paid AI access
            </RouteLink>
          </article>
          <article data-reveal style={{ "--reveal-index": 1 }}>
            <span className="eyebrow">AI training permissions</span>
            <h2>Decide what models can learn from.</h2>
            <p>
              Upload approved datasets, restrict sensitive content, and manage privacy levels for writing style,
              personalization, and licensing workflows.
            </p>
            <RouteLink to="/training" className="secondaryButton smallButton">
              Configure training
            </RouteLink>
          </article>
        </section>

        <section className="section" id="pricing" data-reveal>
          <div className="sectionHeader">
            <span className="eyebrow">Pricing</span>
            <h2>Start with visibility. Scale into control and monetization.</h2>
          </div>
          <div className="pricingGrid">
            {billingPlans.map((plan, index) => (
              <article
                className={plan.highlighted ? "pricingCard highlighted" : "pricingCard"}
                key={plan.key}
                data-reveal
                style={{ "--reveal-index": index }}
              >
                <div className="pricingTopline">
                  <h3>{plan.name}</h3>
                  <div className="pricingBadges">
                    {plan.highlighted && <span>Popular</span>}
                    {normalizedCurrentPlan === plan.key && <span className="currentPlanBadge">Current</span>}
                  </div>
                </div>
                <strong>
                  {plan.price}
                  <span>{plan.cadence}</span>
                </strong>
                <p>{plan.description}</p>
                {plan.bullets.map((bullet) => (
                  <span key={bullet}>{bullet}</span>
                ))}
                <button
                  type="button"
                  className={plan.highlighted ? "primaryButton smallButton" : "secondaryButton smallButton"}
                  onClick={() => handlePlanSelect(plan.key)}
                  disabled={billingLoadingPlan === plan.key}
                >
                  {billingLoadingPlan === plan.key
                    ? "Preparing..."
                    : normalizedCurrentPlan === plan.key
                      ? "Current plan"
                      : `Choose ${plan.name}`}
                </button>
              </article>
            ))}
          </div>
          <div className="pricingActions" data-reveal>
            <button type="button" className="secondaryButton smallButton" onClick={handleManageBilling}>
              Manage billing
            </button>
            {billingMessage && (
              <p className="billingStatus" role="status">
                {billingMessage}
              </p>
            )}
          </div>
        </section>

        <section className="section faq" data-reveal>
          <div className="sectionHeader">
            <span className="eyebrow">FAQ</span>
            <h2>Questions teams ask before turning on AI controls.</h2>
          </div>
          <details open>
            <summary>Does KtrlAI block search engines?</summary>
            <p>No. Policies can distinguish traditional search visibility, AI answer usage, full content access, and training activity.</p>
          </details>
          <details>
            <summary>Can I monetize without blocking everything?</summary>
            <p>Yes. KtrlAI supports summary-only access, paid crawl rules, and dataset licensing so teams can price approved use.</p>
          </details>
          <details>
            <summary>Is this a real tracker integration?</summary>
            <p>The current app uses a mock backend, but the settings page includes the production-style script and domain workflow.</p>
          </details>
        </section>
      </main>
      <Footer />
    </div>
  );
}
