import { getSupabaseAccessToken } from "../lib/supabaseClient.js";
import { allowLocalMockFallback, getTrackerInstallUrl } from "../config/runtime.js";

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const maskGlyph = "\u2022";
const concealedApiKeyMask = `ktrl_live_${maskGlyph.repeat(10)}`;

function randomString(length) {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : null;

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function createId(prefix) {
  return `${prefix}_${randomString(10).toLowerCase()}`;
}

function createMockFallbackError(message) {
  const error = new Error(message);

  if (allowLocalMockFallback) {
    error.useMockFallback = true;
  }

  return error;
}

export function normalizeDomainInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function generateVerificationToken() {
  return `vt_${randomString(28)}`;
}

export function buildDnsRecord(hostname, token) {
  return {
    type: "TXT",
    host: `_ktrlai.${hostname}`,
    value: `ktrlai-verify=${token}`
  };
}

export function createDomainVerification(hostname, overrides = {}) {
  const normalizedHostname = normalizeDomainInput(hostname);
  const verificationToken = overrides.verificationToken || generateVerificationToken();

  // Supabase handoff:
  // domains.verification_token stores verificationToken.
  // domains.verified_at is set by a server check after DNS TXT validation.
  return {
    id: overrides.id || createId("dom"),
    hostname: normalizedHostname,
    status: overrides.status || "Pending",
    verificationToken,
    verifiedAt: overrides.verifiedAt || null,
    lastCheckedAt: overrides.lastCheckedAt || null,
    createdAt: overrides.createdAt || new Date().toISOString()
  };
}

export function markDomainVerified(domain) {
  const checkedAt = new Date().toISOString();

  return {
    ...domain,
    status: "Verified",
    verifiedAt: checkedAt,
    lastCheckedAt: checkedAt
  };
}

export function generateWorkspaceApiKey() {
  return `ktrl_live_${randomString(24)}`;
}

export function maskApiKey(key) {
  const value = String(key || "");

  if (!value) {
    return concealedApiKeyMask;
  }

  if (value.length <= 14) {
    return concealedApiKeyMask;
  }

  return `${value.slice(0, 10)}${maskGlyph.repeat(10)}${value.slice(-4)}`;
}

export function createWorkspaceApiKey(overrides = {}) {
  const key = overrides.key === null ? "" : overrides.key || generateWorkspaceApiKey();

  // Supabase handoff:
  // api_keys.key_hash stores only a one-way hash of key.
  // api_keys.last_used_at is updated by server-side event ingestion.
  // Never persist a live secret key in frontend storage in production.
  return {
    id: overrides.id || createId("key"),
    key,
    maskedKey: maskApiKey(key),
    oneTimeReveal: Boolean(key && overrides.oneTimeReveal !== false),
    lastUsedAt: overrides.lastUsedAt || null,
    rotatedAt: overrides.rotatedAt || new Date().toISOString()
  };
}

export function buildTrackerSnippet({ workspaceId = "demo", apiKey }) {
  const appUrl = getTrackerInstallUrl();
  return `<script async src="${appUrl}/tracker.js" data-workspace-id="${workspaceId}" data-api-key="${apiKey || concealedApiKeyMask}" data-endpoint="${appUrl}/api/track"></script>`;
}

export function toDomainStatusLabel(status) {
  const normalized = String(status || "Pending").toLowerCase();
  const labels = {
    pending: "Pending",
    verified: "Verified",
    failed: "Failed",
    disabled: "Disabled"
  };

  return labels[normalized] || "Pending";
}

export function mergeDomainVerificationResult(currentDomain, resultDomain = {}) {
  return {
    ...currentDomain,
    id: resultDomain.id || currentDomain.id,
    hostname: resultDomain.hostname || currentDomain.hostname,
    status: toDomainStatusLabel(resultDomain.status || currentDomain.status),
    verificationToken: resultDomain.verificationToken || resultDomain.verification_token || currentDomain.verificationToken,
    verifiedAt: resultDomain.verifiedAt || resultDomain.verified_at || currentDomain.verifiedAt,
    lastCheckedAt: resultDomain.lastCheckedAt || resultDomain.last_checked_at || currentDomain.lastCheckedAt
  };
}

export async function verifyDomainWithApi({ domainId, workspaceId }) {
  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    throw createMockFallbackError("Domain verification endpoint is not available.");
  }

  const response = await fetch("/api/verify-domain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({
      domain_id: domainId,
      workspace_id: workspaceId
    })
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw createMockFallbackError("Domain verification endpoint is not available.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Domain verification failed.");
  }

  return data;
}

export async function rotateApiKeyWithApi({ workspaceId, action = "rotate" }) {
  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    throw createMockFallbackError("API key endpoint is not available.");
  }

  const response = await fetch("/api/api-key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({
      action,
      workspace_id: workspaceId
    })
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw createMockFallbackError("API key endpoint is not available.");
  }

  const data = await response.json();

  if (!response.ok || !data.apiKey) {
    throw new Error(data.message || "API key rotation failed.");
  }

  return data;
}
