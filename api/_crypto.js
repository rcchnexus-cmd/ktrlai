import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const apiKeyHashSecret = process.env.API_KEY_HASH_SECRET || "";
const apiKeyPattern = /^ktrl_live_[A-Za-z0-9]{12,96}$/;
const maskGlyph = "\u2022";
const maskedApiKey = `ktrl_live_${maskGlyph.repeat(10)}`;

export function isApiKeyHashingConfigured() {
  return Boolean(apiKeyHashSecret);
}

export function generateApiKey() {
  return `ktrl_live_${randomBytes(24).toString("hex")}`;
}

export function validateApiKeyFormat(apiKey) {
  return apiKeyPattern.test(String(apiKey || ""));
}

export function getApiKeyPrefix(apiKey) {
  return String(apiKey || "").slice(0, 18);
}

export function maskApiKey(apiKey) {
  const key = String(apiKey || "");
  if (!key) {
    return maskedApiKey;
  }

  return `${key.slice(0, 10)}${maskGlyph.repeat(10)}${key.slice(-4)}`;
}

export function hashApiKey(apiKey) {
  if (!isApiKeyHashingConfigured()) {
    throw new Error("API_KEY_HASH_SECRET is not configured.");
  }

  return createHmac("sha256", apiKeyHashSecret).update(String(apiKey)).digest("hex");
}

export function compareApiKeyHash(apiKey, storedHash) {
  if (!storedHash) {
    return false;
  }

  const candidateHash = hashApiKey(apiKey);
  const candidate = Buffer.from(candidateHash, "hex");
  const stored = Buffer.from(String(storedHash), "hex");

  if (candidate.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(candidate, stored);
}

export const concealedApiKeyMask = maskedApiKey;
