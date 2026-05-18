import { useEffect, useState } from "react";
import MarketingNav from "../components/MarketingNav.jsx";
import Footer from "../components/Footer.jsx";
import { RouteLink } from "../navigation.jsx";
import { billingPlans, normalizePlan } from "../billing/stripeConfig.js";
import { openBillingPortal, startBillingCheckout } from "../billing/billingApi.js";
import { useApp } from "../context/AppContext.jsx";

const trust = ["API keys", "Audit logs", "Redis rate limiting", "Rollup analytics", "Notifications", "Jobs/queues", "Governance policies"];
const teams = ["Publishers", "SEO teams", "SaaS teams", "Content platforms", "Enterprise operators"];

const whatKtrlAiDoes = [
  "See which AI systems access your site",
  "Set rules for AI crawlers and training access",
  "Prepare content usage for licensing and commercial terms"
];

const howItWorks = [
  ["install", "Install tracker", "Add a lightweight script and connect the domains you want KtrlAI to monitor."],
  ["signal", "Detect AI crawlers", "Identify AI systems, suspicious scrapers, search bots, and normal browser traffic."],
  ["shield", "Govern access", "Set policies for allowed, monitored, restricted, block-ready, or charge-ready access."],
  ["audit", "Review intelligence", "See accessed paths, operators, source mix, policy decisions, and usage trends."]
];

const features = [
  ["signal", "Crawler intelligence", "See which AI systems, search engines, and scrapers access your web properties."],
  ["shield", "Governance policies", "Set rules for approved bots, unknown crawlers, summaries, and training use."],
  ["revenue", "Licensing readiness", "Prepare crawl fees, dataset licenses, and partner terms when value is created."],
  ["training", "Training permissions", "Choose what content and style signals models may use."],
  ["audit", "Audit-ready records", "Keep a clean record of identity, paths, decisions, and operational events."],
  ["install", "Production installation", "Use API keys, domain verification, rate limits, and tracker health checks."]
];

const useCases = [
  ["Publishers", "Monitor AI crawlers, protect premium content, and prepare licensing conversations."],
  ["SEO agencies", "Show clients how AI answer engines and crawlers interact with their sites."],
  ["SaaS companies", "Track docs, changelog, and knowledge-base access from AI systems."],
  ["Content platforms", "Govern large content libraries and detect unusual scraping pressure."],
  ["Enterprise teams", "Give security, legal, and growth teams shared evidence around AI access."]
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

function InfrastructurePreview() {
  const previewActivity = [
    ["12:04", "ChatGPT-User", "/pricing", "Monitor"],
    ["12:02", "PerplexityBot", "/guides/api", "Restrict"],
    ["11:58", "ClaudeBot", "/blog/licensing", "Allow"]
  ];

  return (
    <div className="heroMockup infrastructurePreview" aria-label="KtrlAI infrastructure preview">
      <div className="infraPreviewHeader">
        <span>AI access control plane</span>
        <strong>Live infrastructure ready</strong>
      </div>
      <div className="infraFlow">
        <article>
          <span>Website</span>
          <strong>docs.company.com</strong>
          <em>Tracker installed</em>
        </article>
        <div className="infraFlowLine" aria-hidden="true" />
        <article>
          <span>KtrlAI</span>
          <strong>Detect + govern</strong>
          <em>Policies and evidence</em>
        </article>
        <div className="infraFlowLine" aria-hidden="true" />
        <article>
          <span>AI systems</span>
          <strong>Allowed / monitored</strong>
          <em>Licensing ready</em>
        </article>
      </div>
      <div className="infraPreviewGrid">
        <article>
          <span>AI requests</span>
          <strong>128k</strong>
          <em>Observed this month</em>
        </article>
        <article>
          <span>Policies</span>
          <strong>18</strong>
          <em>Active governance rules</em>
        </article>
        <article>
          <span>Suspicious</span>
          <strong>42</strong>
          <em>Events requiring review</em>
        </article>
      </div>
      <div className="infraEventList">
        <div className="infraEventHeader">
          <span>Recent evidence</span>
          <strong>Action</strong>
        </div>
        {previewActivity.map(([time, botName, path, action]) => (
          <div key={`${time}-${botName}`}>
            <span>{time}</span>
            <strong>{botName}</strong>
            <em>{path}</em>
            <b>{action}</b>
          </div>
        ))}
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
  const hasBillingPortal = Boolean(state.auth.workspace?.hasStripeCustomer);

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
      workspaceId: state.auth.workspaceId
    });

    setBillingMessage(result.message || "");
    setBillingLoadingPlan("");
  };

  const handleManageBilling = async () => {
    const result = await openBillingPortal({ workspaceId: state.auth.workspaceId });
    setBillingMessage(result.message || "");
  };

  return (
    <div className="site">
      <MarketingNav />
      <main>
        <section className="heroSection" data-reveal>
          <div className="heroCopy">
            <div className="heroPill">AI crawler governance for website owners</div>
            <h1>Control how AI systems access your website.</h1>
            <p>
              Monitor AI crawlers, understand what they access, and set governance policies for your content.
            </p>
            <p className="heroInfrastructureNote">
              KtrlAI gives website owners visibility and control over AI crawler activity, similar to an analytics and
              governance layer for AI access.
            </p>
            <div className="heroActions">
              <RouteLink to="/signup" className="primaryButton heroPrimaryCta">
                Start free
              </RouteLink>
              <RouteLink to="#how-it-works" className="secondaryButton">
                View how it works
              </RouteLink>
            </div>
          </div>
          <InfrastructurePreview />
        </section>

        <section className="authorityStrip" aria-label="Trusted by modern teams" data-reveal>
          <span>Built for operators of the open web</span>
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

        <section className="section productIntro twoColumn" data-reveal>
          <div>
            <span className="eyebrow">What is KtrlAI?</span>
            <h2>Infrastructure for monitoring and governing AI crawler access.</h2>
            <p className="introStatement">
              KtrlAI gives publishers, SaaS companies, SEO teams, content platforms, and enterprises a control plane
              for AI traffic across their websites.
            </p>
          </div>
          <div className="checkList">
            {whatKtrlAiDoes.map((item, index) => (
              <span key={item} data-reveal style={{ "--reveal-index": index }}>
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="section solutionBand" id="how-it-works" data-reveal>
          <span className="eyebrow">How it works</span>
          <h2>Four steps from unknown crawler traffic to governed access.</h2>
          <div className="workflow onboardingWorkflow">
            {howItWorks.map(([icon, title, body], index) => (
              <article key={title} data-reveal style={{ "--reveal-index": index }}>
                <FeatureGlyph type={icon} />
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section twoColumn" data-reveal>
          <div>
            <span className="eyebrow">The problem</span>
            <h2>AI systems access websites without clear visibility, rules, or commercial terms.</h2>
          </div>
          <div className="stackedCopy">
            <p>
              AI systems crawl, summarize, cite, cache, and train on public websites. Most teams cannot clearly see
              which systems visited, what they used, or whether access matched business policy.
            </p>
            <p>
              Traditional robots controls were designed for search-era crawlers. KtrlAI adds the telemetry, governance,
              and licensing readiness needed for AI-era distribution.
            </p>
          </div>
        </section>

        <section className="section solutionBand" data-reveal>
          <span className="eyebrow">The solution</span>
          <h2>Monitor access, govern crawler behavior, and prepare for future content licensing.</h2>
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

        <section className="section useCaseSection" data-reveal>
          <div className="sectionHeader">
            <span className="eyebrow">Who it is for</span>
            <h2>For teams responsible for content visibility, traffic quality, and data control.</h2>
          </div>
          <div className="useCaseGrid">
            {useCases.map(([title, body], index) => (
              <article key={title} data-reveal style={{ "--reveal-index": index }}>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" data-reveal>
          <div className="sectionHeader">
            <span className="eyebrow">Infrastructure</span>
            <h2>The operating layer for AI crawler governance.</h2>
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
            <h2>A sober control plane for AI traffic and governance evidence.</h2>
            <p>
              KtrlAI connects crawler detection, governance policies, activity logs, domain verification, API keys,
              and licensing readiness in one operating surface.
            </p>
            <RouteLink to="/dashboard" className="secondaryButton">
              Open operations console
            </RouteLink>
          </div>
          <div className="previewMatrix">
            <article data-reveal style={{ "--reveal-index": 0 }}>
              <strong>42</strong>
              <span>detected operators</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 1 }}>
              <strong>3.8k</strong>
              <span>governed paths</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 2 }}>
              <strong>$24.8k</strong>
              <span>licensing estimate</span>
            </article>
            <article data-reveal style={{ "--reveal-index": 3 }}>
              <strong>Ready</strong>
              <span>tracker health</span>
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

        <section className="section solutionBand companyMission" id="about" data-reveal>
          <span className="eyebrow">Private beta</span>
          <h2>Help define the governance layer for AI access to the open web.</h2>
          <p>
            KtrlAI is built for teams that need evidence, controls, and licensing readiness before AI crawler traffic
            becomes another unmanaged business channel.
          </p>
          <div className="missionStats" aria-label="Company principles">
            <span>Visibility first</span>
            <span>Control by default</span>
            <span>Value for owners</span>
          </div>
        </section>

        <section className="section splitBand" data-reveal>
          <article data-reveal style={{ "--reveal-index": 0 }}>
            <span className="eyebrow">Monetization</span>
            <h2>Prepare content access for licensing.</h2>
            <p>
              Configure paid access for crawler usage, answer summaries, and dataset licensing. Model projected revenue
              before turning on enforcement.
            </p>
            <RouteLink to="/monetization" className="primaryButton smallButton">
              Review licensing
            </RouteLink>
          </article>
          <article data-reveal style={{ "--reveal-index": 1 }}>
            <span className="eyebrow">AI training permissions</span>
            <h2>Define what models may learn from.</h2>
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
                  disabled={billingLoadingPlan === plan.key || normalizedCurrentPlan === plan.key}
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
            {hasBillingPortal ? (
              <button type="button" className="secondaryButton smallButton" onClick={handleManageBilling}>
                Manage billing
              </button>
            ) : null}
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
            <p>Yes. Install the tracker script from Settings, rotate a workspace API key, and verified events flow into your activity logs.</p>
          </details>
        </section>
      </main>
      <Footer />
    </div>
  );
}
