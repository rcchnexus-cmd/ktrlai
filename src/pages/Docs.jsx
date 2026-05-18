import { useMemo, useState } from "react";
import Footer from "../components/Footer.jsx";
import MarketingNav from "../components/MarketingNav.jsx";
import { getTrackerInstallUrl } from "../config/runtime.js";
import { RouteLink, useNavigation } from "../navigation.jsx";

const docRoutes = [
  { to: "/docs", label: "Overview" },
  { to: "/docs/install", label: "Install" },
  { to: "/docs/sdk", label: "SDK" },
  { to: "/docs/analytics", label: "Analytics" },
  { to: "/docs/billing", label: "Billing" }
];

function CopyBlock({ code, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    } else if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="docsCodeCard">
      <div>
        <span>{label}</span>
        <button type="button" className="secondaryButton smallButton" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="installCodeBlock">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DocsLayout({ title, intro, children, search, setSearch }) {
  const { path } = useNavigation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="site docsSite">
      <MarketingNav />
      <main className="docsShell">
        <aside className={isMobileNavOpen ? "docsSidebar open" : "docsSidebar"}>
          <div className="docsSidebarHeader">
            <strong>Docs</strong>
            <button type="button" className="secondaryButton smallButton" onClick={() => setIsMobileNavOpen(false)}>
              Close
            </button>
          </div>
          <nav aria-label="Documentation">
            {docRoutes.map((route) => (
              <RouteLink
                key={route.to}
                to={route.to}
                className={path === route.to ? "active" : ""}
                onClick={() => setIsMobileNavOpen(false)}
              >
                {route.label}
              </RouteLink>
            ))}
          </nav>
          <RouteLink to="/help" className="docsHelpLink" onClick={() => setIsMobileNavOpen(false)}>
            Need help?
          </RouteLink>
        </aside>
        <section className="docsContent">
          <button type="button" className="secondaryButton smallButton docsMobileToggle" onClick={() => setIsMobileNavOpen(true)}>
            Browse docs
          </button>
          <div className="docsHero">
            <span className="eyebrow">KtrlAI Docs</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            <label className="docsSearch">
              Search docs
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search install, SDK, billing..." />
            </label>
          </div>
          {children}
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function Docs() {
  const { path } = useNavigation();
  const [search, setSearch] = useState("");
  const trackerUrl = getTrackerInstallUrl();
  const snippets = useMemo(
    () => ({
      html: `<script async src="${trackerUrl}/tracker.js" data-workspace-id="YOUR_WORKSPACE_ID" data-api-key="ktrl_live_your_key" data-endpoint="${trackerUrl}/api/track"></script>`,
      react: `import { useEffect } from "react";

export function KtrlAITracker() {
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "${trackerUrl}/tracker.js";
    script.dataset.workspaceId = "YOUR_WORKSPACE_ID";
    script.dataset.apiKey = "ktrl_live_your_key";
    script.dataset.endpoint = "${trackerUrl}/api/track";
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return null;
}`,
      next: `<Script
  src="${trackerUrl}/tracker.js"
  strategy="afterInteractive"
  data-workspace-id="YOUR_WORKSPACE_ID"
  data-api-key="ktrl_live_your_key"
  data-endpoint="${trackerUrl}/api/track"
/>`,
      wordpress: `<!-- Add in your theme header or a trusted header-injection plugin -->
<script async src="${trackerUrl}/tracker.js"
  data-workspace-id="YOUR_WORKSPACE_ID"
  data-api-key="ktrl_live_your_key"
  data-endpoint="${trackerUrl}/api/track"></script>`,
      webflow: `<!-- Webflow Project Settings > Custom Code > Head Code -->
<script async src="${trackerUrl}/tracker.js"
  data-workspace-id="YOUR_WORKSPACE_ID"
  data-api-key="ktrl_live_your_key"
  data-endpoint="${trackerUrl}/api/track"></script>`,
      shopify: `<!-- Shopify theme.liquid, before </head> -->
<script async src="${trackerUrl}/tracker.js"
  data-workspace-id="YOUR_WORKSPACE_ID"
  data-api-key="ktrl_live_your_key"
  data-endpoint="${trackerUrl}/api/track"></script>`,
      sdk: `window.KtrlAI.track("content_accessed", {
  contentType: "article",
  policy: "summary_only"
});

window.KtrlAI.identify("visitor_123", {
  accountType: "subscriber"
});

window.KtrlAI.page();`
    }),
    [trackerUrl]
  );
  const query = search.trim().toLowerCase();
  const matches = (text) => !query || text.toLowerCase().includes(query);

  const pages = {
    "/docs": {
      title: "Build with KtrlAI",
      intro: "Install the tracker, understand AI crawler activity, and connect content governance to real analytics.",
      body: (
        <>
          <section className="docsGrid">
            {[
              ["Install tracker", "Add a single script and verify that KtrlAI is receiving live activity.", "/docs/install"],
              ["Use the SDK", "Send page, custom, and identify events from modern websites and apps.", "/docs/sdk"],
              ["Understand analytics", "Learn how KtrlAI classifies AI assistants, training crawlers, search, and suspicious traffic.", "/docs/analytics"],
              ["Billing", "Understand plans, workspace limits, and how hosted Stripe checkout fits the product.", "/docs/billing"]
            ]
              .filter(([title, body]) => matches(`${title} ${body}`))
              .map(([title, body, to]) => (
                <article className="docsCard" key={title}>
                  <h2>{title}</h2>
                  <p>{body}</p>
                  <RouteLink to={to} className="textLink">
                    Read guide
                  </RouteLink>
                </article>
              ))}
          </section>
          <section className="docsArticle docsFaq">
            <h2>Quick answers</h2>
            <article>
              <strong>What is KtrlAI?</strong>
              <p>KtrlAI is an AI governance platform that helps websites track, control, and monetize how AI systems access their content.</p>
            </article>
            <article>
              <strong>Do I need a backend?</strong>
              <p>No. Install the browser tracker first. Server-side controls, billing, and admin operations are handled by KtrlAI APIs.</p>
            </article>
            <article>
              <strong>How do I know it is live?</strong>
              <p>Configuration shows tracker health, last event received, and events today. Operations switches to live data once events arrive.</p>
            </article>
          </section>
        </>
      )
    },
    "/docs/install": {
      title: "Install KtrlAI tracker",
      intro: "Connect a website, CMS, storefront, or app and start receiving live AI access events.",
      body: (
        <section className="docsArticle">
          <h2>HTML</h2>
          <p>Use this snippet for static sites, Webflow custom code, tag managers, and simple hosted tests.</p>
          <CopyBlock label="HTML script" code={snippets.html} />
          <h2>React / Vite</h2>
          <CopyBlock label="React component" code={snippets.react} />
          <h2>Next.js</h2>
          <CopyBlock label="Next Script" code={snippets.next} />
          <h2>WordPress, Shopify, and Webflow</h2>
          <p>Paste the HTML script into your theme header, custom code area, or storefront layout. Test from a local server or hosted preview rather than opening a file directly from disk.</p>
          <CopyBlock label="WordPress header" code={snippets.wordpress} />
          <CopyBlock label="Webflow custom code" code={snippets.webflow} />
          <CopyBlock label="Shopify theme" code={snippets.shopify} />
          <CopyBlock label="Local test" code={"npx serve .\n# open the localhost URL for ktrlai-test.html"} />
          <h2>Troubleshooting</h2>
          <p>If the first event does not appear, confirm the snippet contains the real workspace ID and a freshly generated API key, then test from a localhost or hosted URL so browser networking behaves like production.</p>
        </section>
      )
    },
    "/docs/sdk": {
      title: "Browser SDK",
      intro: "The KtrlAI SDK queues events asynchronously, tracks page views, and supports SPA navigation.",
      body: (
        <section className="docsArticle">
          <h2>Methods</h2>
          <p><strong>init()</strong> configures the SDK. <strong>page()</strong> sends a page event. <strong>track()</strong> sends custom events. <strong>identify()</strong> attaches visitor context.</p>
          <CopyBlock label="SDK examples" code={snippets.sdk} />
          <h2>Troubleshooting</h2>
          <p>Confirm your API key is current, the snippet includes <code>data-endpoint</code>, and your browser network tab shows a POST to <code>/api/track</code>.</p>
          <p>The SDK prevents duplicate initialization, queues events asynchronously, and retries without blocking page rendering.</p>
        </section>
      )
    },
    "/docs/analytics": {
      title: "Analytics and AI detection",
      intro: "KtrlAI turns raw activity logs into AI bot intelligence, suspicious crawler detection, and content-level analytics.",
      body: (
        <section className="docsArticle">
          <h2>AI detection</h2>
          <p>KtrlAI classifies known AI assistants, AI training bots, search crawlers, social preview bots, browsers, and suspicious scrapers using user-agent, headers, referrer, and signature rules.</p>
          <h2>Confidence</h2>
          <p>High-confidence matches come from known crawler signatures such as GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and ChatGPT-User. Suspicious or incomplete signals are labeled more conservatively.</p>
          <h2>Live vs sample data</h2>
          <p>When live tracker events exist, analytics use real Supabase activity logs. If investor sample data is enabled and no events exist yet, KtrlAI clearly labels the preview as sample data.</p>
        </section>
      )
    },
    "/docs/billing": {
      title: "Billing and plans",
      intro: "KtrlAI uses hosted Stripe Checkout and server-side plan enforcement for domains, API keys, and events.",
      body: (
        <section className="docsArticle">
          <h2>Plans</h2>
          <p>Free is designed for initial visibility. Pro adds larger event volume and more domains. Business supports larger teams and higher platform limits.</p>
          <h2>Security</h2>
          <p>Stripe secret keys remain server-side. Webhooks are verified before subscription state is synced to the workspace.</p>
          <h2>Failed or incomplete payments</h2>
          <p>Subscription states such as past due, incomplete, unpaid, and canceled are surfaced in Settings so workspace owners know when billing needs attention.</p>
        </section>
      )
    }
  };

  const page = pages[path] || pages["/docs"];

  return (
    <DocsLayout title={page.title} intro={page.intro} search={search} setSearch={setSearch}>
      {page.body}
    </DocsLayout>
  );
}
