import {
  buildTrackerSnippet,
  createDomainVerification,
  createWorkspaceApiKey,
  markDomainVerified,
  notificationPreferenceDefaults,
  normalizeDomainInput
} from "../settings/securityUtils.js";

const delay = (ms = 420) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

// Investor sample data and local-development fallback.
// Production writes must use Supabase/API routes; this module keeps dashboard
// presentation data available and helps local development when env vars are absent.

const activityLogs = [
  {
    id: "evt_1001",
    bot: "ChatGPT-User",
    type: "Conversational AI",
    page: "/research/market-map",
    status: "Allowed",
    date: "2026-05-02",
    time: "09:42",
    tokens: "18.4k",
    region: "US"
  },
  {
    id: "evt_1002",
    bot: "PerplexityBot",
    type: "Answer Engine",
    page: "/guides/licensing-data",
    status: "Summaries only",
    date: "2026-05-02",
    time: "08:17",
    tokens: "9.2k",
    region: "CA"
  },
  {
    id: "evt_1003",
    bot: "ClaudeBot",
    type: "Training Crawler",
    page: "/blog/agentic-search",
    status: "Blocked",
    date: "2026-05-01",
    time: "20:36",
    tokens: "0",
    region: "IE"
  },
  {
    id: "evt_1004",
    bot: "Google-Extended",
    type: "Search AI",
    page: "/pricing",
    status: "Allowed",
    date: "2026-05-01",
    time: "16:51",
    tokens: "6.7k",
    region: "US"
  },
  {
    id: "evt_1005",
    bot: "Unknown LLM Crawler",
    type: "Unknown",
    page: "/docs/private-api",
    status: "Blocked",
    date: "2026-04-30",
    time: "22:03",
    tokens: "0",
    region: "SG"
  },
  {
    id: "evt_1006",
    bot: "OAI-SearchBot",
    type: "Search AI",
    page: "/case-studies/media",
    status: "Paid access",
    date: "2026-04-30",
    time: "13:28",
    tokens: "27.1k",
    region: "US"
  },
  {
    id: "evt_1007",
    bot: "Meta-ExternalAgent",
    type: "Training Crawler",
    page: "/blog/content-rights",
    status: "Restricted",
    date: "2026-04-29",
    time: "11:05",
    tokens: "4.8k",
    region: "GB"
  },
  {
    id: "evt_1008",
    bot: "MistralFetch",
    type: "Conversational AI",
    page: "/reports/q2-ai-traffic",
    status: "Allowed",
    date: "2026-04-29",
    time: "06:49",
    tokens: "12.6k",
    region: "FR"
  }
];

const dashboard = {
  kpis: [
    { label: "Total AI Visits", value: "128,450", change: "+18.2%", tone: "positive" },
    { label: "Unique AI Bots", value: "42", change: "+7 this week", tone: "neutral" },
    { label: "Pages Accessed", value: "3,874", change: "+11.6%", tone: "positive" },
    { label: "Revenue from AI", value: "$24,860", change: "+$3.2k", tone: "positive" }
  ],
  traffic: [
    { label: "Mon", value: 42 },
    { label: "Tue", value: 58 },
    { label: "Wed", value: 51 },
    { label: "Thu", value: 74 },
    { label: "Fri", value: 88 },
    { label: "Sat", value: 64 },
    { label: "Sun", value: 96 }
  ],
  botDistribution: [
    { label: "Answer engines", value: 34, color: "#5B8CFF" },
    { label: "Training crawlers", value: 26, color: "#9B6DFF" },
    { label: "Search AI", value: 24, color: "#4ADE80" },
    { label: "Unknown", value: 16, color: "#F97316" }
  ],
  recentActivity: activityLogs.slice(0, 5)
};

const controls = {
  rules: [
    { id: "rule_trusted", label: "Allow trusted bots", enabled: true, detail: "OpenAI, Google AI, Perplexity, and verified partners" },
    { id: "rule_unknown", label: "Block unknown bots", enabled: true, detail: "Reject crawlers without verified AI bot signatures" },
    { id: "rule_depth", label: "Limit scraping depth", enabled: true, detail: "Maximum 3 linked pages per request chain" },
    { id: "rule_summary", label: "Allow summaries only", enabled: false, detail: "Permit generated summaries while withholding full text" },
    { id: "rule_full", label: "Block full content access", enabled: true, detail: "Keep premium pages behind control policies" }
  ],
  customRules: [
    { id: "custom_1", bot: "PerplexityBot", access: "Summaries only", createdAt: "May 1, 2026" },
    { id: "custom_2", bot: "ClaudeBot", access: "Training denied", createdAt: "Apr 29, 2026" }
  ],
  governancePolicies: [
    { id: "policy_gptbot", botScope: "GPTBot", policyType: "monitor", detail: "Track GPTBot activity and attribution paths before enforcement." },
    { id: "policy_claude", botScope: "ClaudeBot", policyType: "monitor", detail: "Monitor Claude access and high-value pages." },
    { id: "policy_perplexity", botScope: "PerplexityBot", policyType: "allow", detail: "Allow answer-engine access with visibility." },
    { id: "policy_google", botScope: "Google-Extended", policyType: "restrict", detail: "Restrict training-oriented crawler access unless licensed." },
    { id: "policy_unknown", botScope: "Unknown/Suspicious", policyType: "block", detail: "Block or review suspicious crawler patterns." }
  ]
};

const visibilityProviders = [
  { name: "ChatGPT", status: "Visible", score: 92, detail: "Your public pages are frequently cited in generated answers." },
  { name: "Perplexity", status: "Partial", score: 68, detail: "Content is discoverable, but source attribution is inconsistent." },
  { name: "Claude", status: "Limited", score: 44, detail: "Crawler access appears constrained by existing policies." },
  { name: "Google AI", status: "Visible", score: 86, detail: "Pages are present in AI overview-style query patterns." }
];

const analytics = {
  trend: [
    { label: "Jan", value: 28 },
    { label: "Feb", value: 36 },
    { label: "Mar", value: 49 },
    { label: "Apr", value: 63 },
    { label: "May", value: 78 }
  ],
  topPages: [
    { page: "/guides/licensing-data", visits: "18,920", revenue: "$8,440" },
    { page: "/research/market-map", visits: "16,104", revenue: "$5,870" },
    { page: "/blog/agentic-search", visits: "10,388", revenue: "$2,940" },
    { page: "/case-studies/media", visits: "8,991", revenue: "$4,210" }
  ],
  botFrequency: [
    { bot: "ChatGPT-User", requests: 38420 },
    { bot: "PerplexityBot", requests: 24790 },
    { bot: "Google-Extended", requests: 18870 },
    { bot: "ClaudeBot", requests: 13280 }
  ],
  sources: [
    { label: "Verified partners", value: 51 },
    { label: "Answer engines", value: 29 },
    { label: "Unknown crawlers", value: 12 },
    { label: "Research labs", value: 8 }
  ]
};

const monetization = {
  source: "preview",
  sourceLabel: "Licensing readiness preview",
  sourceDetail: "Commercial modeling is shown as planning data until live licensing ledger workflows are enabled.",
  paidAccess: true,
  pricePerCrawl: 0.18,
  pricePerDataset: 425,
  projectedMonthly: 31840,
  clearedRevenue: 24860,
  pendingRevenue: 6980,
  earnings: {
    pendingCents: 698000,
    confirmedCents: 2486000,
    availableCents: 1840000,
    currency: "USD"
  },
  deals: [
    { partner: "Verified answer engine", model: "Usage-based crawl", revenue: "$9,840", status: "Active" },
    { partner: "Enterprise LLM lab", model: "Dataset license", revenue: "$11,500", status: "Review" },
    { partner: "Vertical search AI", model: "Summary access", revenue: "$3,520", status: "Active" }
  ],
  ledger: [
    {
      id: "earn_1001",
      source: "Paid crawl access",
      amountCents: 984000,
      currency: "USD",
      status: "confirmed",
      createdAt: "2026-05-02T09:42:00.000Z"
    },
    {
      id: "earn_1002",
      source: "Dataset license",
      amountCents: 1150000,
      currency: "USD",
      status: "pending",
      createdAt: "2026-05-01T16:10:00.000Z"
    },
    {
      id: "earn_1003",
      source: "Summary access",
      amountCents: 352000,
      currency: "USD",
      status: "confirmed",
      createdAt: "2026-04-30T13:28:00.000Z"
    }
  ],
  payoutRequests: [
    {
      id: "payout_1001",
      amountCents: 640000,
      currency: "USD",
      status: "under_review",
      createdAt: "2026-04-29T18:20:00.000Z"
    }
  ]
};

const training = {
  trainOnData: true,
  writingStyle: false,
  datasetLicensing: true,
  personalizationModels: true,
  privacyLevel: "Restricted",
  uploads: [
    { id: "file_1", name: "founder-essays.txt", type: "Text", size: "84 KB", status: "Indexed" },
    { id: "file_2", name: "product-blog-export.md", type: "Markdown", size: "218 KB", status: "Processing" }
  ],
  preview:
    "KtrlAI can generate concise licensing summaries, preserve original source context, and restrict model training to approved datasets."
};

const defaultWorkspaceId = "demo";
const defaultApiKey = createWorkspaceApiKey({
  id: "key_default",
  key: null,
  lastUsedAt: "2026-05-02T09:42:00.000Z",
  rotatedAt: "2026-05-01T13:05:00.000Z"
});

const settings = {
  workspaceId: defaultWorkspaceId,
  script: buildTrackerSnippet({ workspaceId: defaultWorkspaceId, apiKey: defaultApiKey.key }),
  domains: [
    createDomainVerification("ktrlai.customer.com", {
      id: "dom_verified",
      status: "Verified",
      verificationToken: "vt_verifiedDemoToken9x2aPqLmN7sK",
      verifiedAt: "2026-05-01T15:30:00.000Z",
      lastCheckedAt: "2026-05-01T15:30:00.000Z"
    }),
    createDomainVerification("docs.customer.com", {
      id: "dom_pending",
      status: "Pending",
      verificationToken: "vt_pendingDemoToken7uZpQ2kLm8r"
    }),
    createDomainVerification("archive.customer.com", {
      id: "dom_failed",
      status: "Failed",
      verificationToken: "vt_failedDemoToken5hMxA4qRs1b",
      lastCheckedAt: "2026-05-02T10:12:00.000Z"
    })
  ],
  apiKey: defaultApiKey,
  account: {
    name: "Avery Stone",
    email: "avery@northstar.media",
    plan: "Business"
  },
  notificationPreferences: notificationPreferenceDefaults
};

export const mockApi = {
  async getDashboard() {
    await delay();
    return clone(dashboard);
  },
  async getActivityLogs() {
    await delay();
    return clone(activityLogs);
  },
  async getControls() {
    await delay();
    return clone(controls);
  },
  async updateControlRule(ruleId, enabled) {
    await delay(260);
    return { ruleId, enabled };
  },
  async createControlRule(rule) {
    await delay(360);
    return {
      id: `custom_${Date.now()}`,
      createdAt: "Just now",
      ...rule
    };
  },
  async checkVisibility(url) {
    await delay(720);
    const hostname = url.replace(/^https?:\/\//, "").replace(/\/$/, "") || "yourdomain.com";
    return {
      source: "preview",
      sourceLabel: "Visibility preview",
      sourceDetail: "Visibility scans are planning guidance until live provider verification is enabled.",
      url: hostname,
      score: 74,
      lastChecked: "Just now",
      providers: clone(visibilityProviders),
      suggestedQueries: [
        `What is ${hostname} known for?`,
        `Summarize the latest research from ${hostname}`,
        `Which sources cite ${hostname} on AI content licensing?`
      ]
    };
  },
  async getAnalytics() {
    await delay();
    return clone(analytics);
  },
  async getMonetization() {
    await delay();
    return clone(monetization);
  },
  async updateMonetizationSettings(updates) {
    await delay(280);
    return clone(updates);
  },
  async requestPayout({ amountCents, currency = "USD" } = {}) {
    await delay(520);
    const request = {
      id: `payout_${Date.now()}`,
      amountCents,
      currency,
      status: "requested",
      createdAt: new Date().toISOString()
    };

    monetization.payoutRequests = [request, ...monetization.payoutRequests];
    return clone(request);
  },
  async getTraining() {
    await delay();
    return clone(training);
  },
  async updateTrainingSetting(updates) {
    await delay(240);
    return clone(updates);
  },
  async uploadTrainingFile(file) {
    await delay(680);
    return {
      id: `file_${Date.now()}`,
      name: file.name,
      type: file.type || "Document",
      size: file.size || "124 KB",
      status: "Processing"
    };
  },
  async getSettings() {
    await delay();
    return clone(settings);
  },
  async addDomain(domain) {
    await delay(260);
    const hostname = normalizeDomainInput(domain);

    if (!hostname) {
      throw new Error("Enter a valid domain.");
    }

    const createdDomain = createDomainVerification(hostname);
    settings.domains = [createdDomain, ...settings.domains];
    return clone(createdDomain);
  },
  async checkDomainVerification(domainId) {
    await delay(620);
    const domainIndex = settings.domains.findIndex((domain) => domain.id === domainId);

    if (domainIndex === -1) {
      throw new Error("Domain not found.");
    }

    const verifiedDomain = markDomainVerified(settings.domains[domainIndex]);
    settings.domains[domainIndex] = verifiedDomain;
    return clone(verifiedDomain);
  },
  async rotateApiKey() {
    await delay(420);
    const apiKey = createWorkspaceApiKey();
    settings.apiKey = apiKey;
    settings.script = buildTrackerSnippet({ workspaceId: settings.workspaceId, apiKey: apiKey.key });
    return clone({ apiKey, script: settings.script });
  }
};
