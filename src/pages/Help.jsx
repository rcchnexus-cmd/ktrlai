import { useState } from "react";
import Footer from "../components/Footer.jsx";
import MarketingNav from "../components/MarketingNav.jsx";
import { RouteLink } from "../navigation.jsx";

export default function Help() {
  const [message, setMessage] = useState("");

  const mailtoHref = `mailto:support@ktrlai.app?subject=KtrlAI%20support%20request&body=${encodeURIComponent(message || "Tell us what you need help with.")}`;

  return (
    <div className="site helpPage">
      <MarketingNav />
      <main className="helpShell">
        <section className="trustHero">
          <span className="eyebrow">Support</span>
          <h1>How can we help?</h1>
          <p>Get help installing the tracker, verifying domains, understanding AI detection, or preparing billing for production.</p>
        </section>
        <section className="helpGrid">
          <article className="docsCard">
            <h2>Install support</h2>
            <p>Find setup snippets for HTML, React, Next.js, WordPress, Webflow, and Shopify.</p>
            <RouteLink to="/docs/install" className="textLink">
              Read install docs
            </RouteLink>
          </article>
          <article className="docsCard">
            <h2>AI detection</h2>
            <p>Understand how KtrlAI classifies AI assistants, training crawlers, and suspicious scraping.</p>
            <RouteLink to="/docs/analytics" className="textLink">
              Learn detection
            </RouteLink>
          </article>
          <article className="docsCard">
            <h2>Security</h2>
            <p>Review how KtrlAI handles API keys, server-side secrets, workspace roles, and platform admin access.</p>
            <RouteLink to="/security" className="textLink">
              View security
            </RouteLink>
          </article>
        </section>
        <section className="supportForm panel">
          <div>
            <span className="eyebrow">Report issue</span>
            <h2>Send feedback or a support request</h2>
            <p>Describe what happened and include the workspace, route, or browser where you saw it.</p>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="I need help with..."
            rows={6}
          />
          <div className="supportActions">
            <a className="primaryButton smallButton" href={mailtoHref}>
              Email support
            </a>
            <RouteLink to="/docs" className="secondaryButton smallButton">
              Browse docs
            </RouteLink>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
