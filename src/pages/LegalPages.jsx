import Footer from "../components/Footer.jsx";
import MarketingNav from "../components/MarketingNav.jsx";
import { RouteLink } from "../navigation.jsx";

function TrustPage({ eyebrow, title, intro, children }) {
  return (
    <div className="site trustPage">
      <MarketingNav />
      <main className="trustPageShell">
        <section className="trustHero">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </section>
        <section className="trustArticle">{children}</section>
      </main>
      <Footer />
    </div>
  );
}

export function Privacy() {
  return (
    <TrustPage
      eyebrow="Privacy"
      title="Privacy at KtrlAI"
      intro="KtrlAI helps website owners understand and control how AI systems access their content."
    >
      <h2>What KtrlAI collects</h2>
      <p>KtrlAI collects workspace account information, domain configuration, API key metadata, and tracker events needed to identify AI access patterns. Tracker events may include page URL, title, referrer, user agent, timestamp, and SDK metadata.</p>
      <h2>How data is used</h2>
      <p>We use this data to provide visibility, analytics, access controls, billing limits, and operational security. We do not ask customers to upload sensitive secrets into the frontend.</p>
      <h2>Customer control</h2>
      <p>Workspace owners control their domains, API keys, training permissions, and monetization settings from the app.</p>
    </TrustPage>
  );
}

export function Terms() {
  return (
    <TrustPage
      eyebrow="Terms"
      title="Service terms overview"
      intro="These product terms are written for clarity during beta and should be reviewed by counsel before public launch."
    >
      <h2>Use of KtrlAI</h2>
      <p>KtrlAI is intended for website owners and authorized operators who want to monitor, govern, and monetize AI access to their own content and data.</p>
      <h2>Customer responsibilities</h2>
      <p>Customers are responsible for installing the tracker only on properties they control, keeping API keys private, and configuring policies appropriate for their content rights.</p>
      <h2>Beta expectations</h2>
      <p>Some monetization, payout, and enforcement capabilities may be limited during private beta until production controls are explicitly enabled.</p>
    </TrustPage>
  );
}

export function Security() {
  return (
    <TrustPage
      eyebrow="Security"
      title="Security philosophy"
      intro="KtrlAI is designed around server-side secrets, hashed API keys, workspace isolation, and clear operational boundaries."
    >
      <h2>Secrets stay server-side</h2>
      <p>Supabase service role keys, Stripe secret keys, webhook secrets, and API key hashing secrets are never imported into frontend code.</p>
      <h2>API key handling</h2>
      <p>Workspace API keys are shown once on generation or rotation. Stored keys are hashed server-side and only masked metadata is shown after refresh.</p>
      <h2>Workspace boundaries</h2>
      <p>Backend routes require Supabase session checks for sensitive workspace mutations. Admin access is separated from normal workspace access.</p>
    </TrustPage>
  );
}

export function Contact() {
  return (
    <TrustPage
      eyebrow="Contact"
      title="Talk to KtrlAI"
      intro="Questions about AI governance, private beta access, or implementation support? Reach the team directly."
    >
      <div className="contactPanel">
        <div>
          <h2>Contact</h2>
          <p>Email the team for onboarding, billing, security, or partnership questions.</p>
        </div>
        <a className="primaryButton smallButton" href="mailto:contact@ktrlai.app?subject=KtrlAI%20support">
          Email support
        </a>
      </div>
      <div className="contactPanel">
        <div>
          <h2>Need setup help?</h2>
          <p>Open the install docs for snippets, SDK methods, and troubleshooting guidance.</p>
        </div>
        <RouteLink to="/docs/install" className="secondaryButton smallButton">
          View install docs
        </RouteLink>
      </div>
    </TrustPage>
  );
}
