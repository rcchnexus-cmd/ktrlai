const maxHeaderLength = 512;

function sanitize(value, maxLength = maxHeaderLength) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function hasPattern(value, patterns = []) {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeHeaders(headers = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(headers || {})) {
    const headerValue = Array.isArray(value) ? value.join(", ") : value;
    normalized[String(key).toLowerCase()] = sanitize(headerValue);
  }

  return normalized;
}

export const botSignatures = [
  {
    bot_name: "GPTBot",
    normalized_name: "gptbot",
    category: "ai_training",
    bot_type: "GPTBot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 99,
    patterns: [/gptbot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "ChatGPT-User",
    normalized_name: "chatgpt_user",
    category: "ai_assistant",
    bot_type: "ChatGPT-User",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 98,
    patterns: [/chatgpt-user/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "OAI-SearchBot",
    normalized_name: "oai_searchbot",
    category: "ai_assistant",
    bot_type: "OAI-SearchBot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 98,
    patterns: [/oai-searchbot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "ClaudeBot",
    normalized_name: "claudebot",
    category: "ai_training",
    bot_type: "ClaudeBot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 98,
    patterns: [/claudebot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Claude-Web",
    normalized_name: "claude_web",
    category: "ai_assistant",
    bot_type: "Claude-Web",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 96,
    patterns: [/claude-web/i, /anthropic-ai/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "PerplexityBot",
    normalized_name: "perplexitybot",
    category: "ai_assistant",
    bot_type: "PerplexityBot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 98,
    patterns: [/perplexitybot/i, /perplexity-user/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Google-Extended",
    normalized_name: "google_extended",
    category: "ai_training",
    bot_type: "Google-Extended",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 98,
    patterns: [/google-extended/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Gemini",
    normalized_name: "gemini",
    category: "ai_assistant",
    bot_type: "Gemini",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 88,
    patterns: [/gemini/i, /googleother/i],
    detection_method: "known_ai_pattern"
  },
  {
    bot_name: "CCBot",
    normalized_name: "ccbot",
    category: "ai_training",
    bot_type: "CCBot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 96,
    patterns: [/ccbot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Bytespider",
    normalized_name: "bytespider",
    category: "ai_training",
    bot_type: "Bytespider",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 96,
    patterns: [/bytespider/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Amazonbot",
    normalized_name: "amazonbot",
    category: "ai_training",
    bot_type: "Amazonbot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 94,
    patterns: [/amazonbot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Applebot",
    normalized_name: "applebot",
    category: "ai_training",
    bot_type: "Applebot",
    is_ai_bot: true,
    is_search_engine: false,
    confidence: 93,
    patterns: [/applebot/i],
    detection_method: "known_ai_user_agent"
  },
  {
    bot_name: "Googlebot",
    normalized_name: "googlebot",
    category: "search_engine",
    bot_type: "Googlebot",
    is_ai_bot: false,
    is_search_engine: true,
    confidence: 97,
    patterns: [/googlebot/i],
    detection_method: "known_search_user_agent"
  },
  {
    bot_name: "Bingbot",
    normalized_name: "bingbot",
    category: "search_engine",
    bot_type: "Bingbot",
    is_ai_bot: false,
    is_search_engine: true,
    confidence: 97,
    patterns: [/bingbot/i],
    detection_method: "known_search_user_agent"
  },
  {
    bot_name: "DuckDuckBot",
    normalized_name: "duckduckbot",
    category: "search_engine",
    bot_type: "DuckDuckBot",
    is_ai_bot: false,
    is_search_engine: true,
    confidence: 96,
    patterns: [/duckduckbot/i],
    detection_method: "known_search_user_agent"
  },
  {
    bot_name: "Facebook Crawler",
    normalized_name: "facebook_crawler",
    category: "social_preview",
    bot_type: "Facebook crawler",
    is_ai_bot: false,
    is_search_engine: false,
    confidence: 95,
    patterns: [/facebookexternalhit/i, /facebot/i],
    detection_method: "known_social_preview_user_agent"
  },
  {
    bot_name: "Twitterbot",
    normalized_name: "twitterbot",
    category: "social_preview",
    bot_type: "Twitterbot",
    is_ai_bot: false,
    is_search_engine: false,
    confidence: 95,
    patterns: [/twitterbot/i],
    detection_method: "known_social_preview_user_agent"
  },
  {
    bot_name: "LinkedInBot",
    normalized_name: "linkedinbot",
    category: "social_preview",
    bot_type: "LinkedInBot",
    is_ai_bot: false,
    is_search_engine: false,
    confidence: 95,
    patterns: [/linkedinbot/i, /linkedin/i],
    detection_method: "known_social_preview_user_agent"
  }
];

const scraperPatterns = [
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /curl/i,
  /wget/i,
  /aiohttp/i,
  /httpx/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /phpcrawl/i,
  /headlesschrome/i,
  /playwright/i,
  /puppeteer/i
];

const genericCrawlerPatterns = [/bot/i, /crawler/i, /spider/i, /fetcher/i, /scraper/i, /http client/i];
const browserSignals = [/mozilla\/5\.0/i, /applewebkit/i, /chrome\//i, /safari\//i, /firefox\//i, /edg\//i, /mobile/i];
const fakeBrowserSignals = [/mozilla\/5\.0$/i, /^mozilla$/i, /^chrome$/i];

function buildResult(overrides) {
  return {
    bot_name: "Human/Browser",
    bot_type: "Human/Browser",
    confidence_score: 90,
    category: "browser",
    is_ai_bot: false,
    is_search_engine: false,
    is_suspicious: false,
    normalized_name: "human_browser",
    detection_method: "browser_user_agent",
    ...overrides
  };
}

export function detectBot({ userAgent = "", headers = {}, referrer = "" } = {}) {
  const normalizedHeaders = normalizeHeaders(headers);
  const ua = sanitize(userAgent || normalizedHeaders["user-agent"]);
  const lowerUa = ua.toLowerCase();
  const lowerReferrer = sanitize(referrer || normalizedHeaders.referer || normalizedHeaders.referrer).toLowerCase();

  if (!ua) {
    return buildResult({
      bot_name: "Empty User Agent",
      bot_type: "UnknownBot",
      confidence_score: 75,
      category: "unknown",
      is_suspicious: true,
      normalized_name: "empty_user_agent",
      detection_method: "empty_user_agent"
    });
  }

  const signature = botSignatures.find((entry) => hasPattern(ua, entry.patterns));

  if (signature) {
    return buildResult({
      bot_name: signature.bot_name,
      bot_type: signature.bot_type,
      confidence_score: signature.confidence,
      category: signature.category,
      is_ai_bot: signature.is_ai_bot,
      is_search_engine: signature.is_search_engine,
      is_suspicious: false,
      normalized_name: signature.normalized_name,
      detection_method: signature.detection_method
    });
  }

  if (lowerReferrer.includes("chat.openai.com") || lowerReferrer.includes("chatgpt.com")) {
    return buildResult({
      bot_name: "ChatGPT Referral",
      bot_type: "ChatGPT-User",
      confidence_score: 72,
      category: "ai_assistant",
      is_ai_bot: true,
      normalized_name: "chatgpt_referral",
      detection_method: "ai_referrer"
    });
  }

  if (lowerReferrer.includes("perplexity.ai")) {
    return buildResult({
      bot_name: "Perplexity Referral",
      bot_type: "PerplexityBot",
      confidence_score: 72,
      category: "ai_assistant",
      is_ai_bot: true,
      normalized_name: "perplexity_referral",
      detection_method: "ai_referrer"
    });
  }

  if (hasPattern(lowerUa, scraperPatterns)) {
    return buildResult({
      bot_name: "Scraping Library",
      bot_type: "UnknownBot",
      confidence_score: 78,
      category: "scraper",
      is_suspicious: true,
      normalized_name: "scraping_library",
      detection_method: "scraper_user_agent"
    });
  }

  if (hasPattern(lowerUa, fakeBrowserSignals)) {
    return buildResult({
      bot_name: "Suspicious Browser Agent",
      bot_type: "UnknownBot",
      confidence_score: 70,
      category: "scraper",
      is_suspicious: true,
      normalized_name: "suspicious_browser_agent",
      detection_method: "fake_browser_user_agent"
    });
  }

  if (hasPattern(lowerUa, genericCrawlerPatterns)) {
    return buildResult({
      bot_name: "Unknown Crawler",
      bot_type: "UnknownBot",
      confidence_score: 66,
      category: "unknown",
      is_suspicious: true,
      normalized_name: "unknown_crawler",
      detection_method: "generic_crawler_pattern"
    });
  }

  if (hasPattern(lowerUa, browserSignals)) {
    return buildResult();
  }

  return buildResult({
    bot_name: "Unknown Client",
    bot_type: "Unknown",
    confidence_score: 38,
    category: "unknown",
    normalized_name: "unknown_client",
    detection_method: "unknown_user_agent"
  });
}

export function classifyUserAgent(userAgent = "") {
  return detectBot({ userAgent }).bot_type;
}
