export function classifyUserAgent(userAgent = "") {
  const normalized = String(userAgent).toLowerCase();

  if (!normalized) {
    return "Human/Browser";
  }

  if (normalized.includes("chatgpt") || normalized.includes("oai-searchbot") || normalized.includes("openai")) {
    return "ChatGPT";
  }

  if (normalized.includes("claudebot") || normalized.includes("anthropic") || normalized.includes("claude")) {
    return "Claude";
  }

  if (normalized.includes("perplexitybot") || normalized.includes("perplexity")) {
    return "Perplexity";
  }

  if (normalized.includes("google-extended")) {
    return "Google-Extended";
  }

  if (normalized.includes("bot") || normalized.includes("crawler") || normalized.includes("spider")) {
    return "UnknownBot";
  }

  return "Human/Browser";
}
