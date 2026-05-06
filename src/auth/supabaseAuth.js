import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { allowLocalMockFallback } from "../config/runtime.js";
import {
  buildTrackerSnippet,
  maskApiKey,
  normalizeDomainInput,
  toDomainStatusLabel
} from "../settings/securityUtils.js";
import * as mockAuth from "./mockAuth.js";

const ACTIVE_WORKSPACE_KEY = "ktrlai_active_workspace_id";
const bootstrapPromises = new Map();

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function setActiveWorkspaceId(workspaceId) {
  if (canUseStorage() && workspaceId) {
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  }
}

export function getActiveWorkspaceId() {
  if (!canUseStorage()) {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) || "";
}

function clearActiveWorkspaceId() {
  if (canUseStorage()) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  }
}

function nameFromEmail(email) {
  const localPart = String(email || "").split("@")[0] || "KtrlAI User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workspaceNameFromDomain(domain, email) {
  const normalizedDomain = normalizeDomainInput(domain) || String(email || "").split("@")[1] || "workspace";
  const firstSegment = normalizedDomain.split(".")[0] || "workspace";
  return `${firstSegment.charAt(0).toUpperCase()}${firstSegment.slice(1)} Workspace`;
}

function slugify(value) {
  return String(value || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "workspace";
}

function randomSuffix() {
  const bytes = new Uint8Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || String(Date.now()).slice(-8);
}

function mapWorkspace(workspace, role = "owner") {
  if (!workspace) {
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan || "Free",
    role
  };
}

function mapDomain(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    hostname: row.hostname,
    status: toDomainStatusLabel(row.status),
    verificationToken: row.verification_token,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at
  };
}

function mapApiKey(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key: "",
    maskedKey: row.key_prefix ? `${row.key_prefix}${"•".repeat(10)}` : maskApiKey(""),
    keyPrefix: row.key_prefix,
    oneTimeReveal: false,
    lastUsedAt: row.last_used_at,
    rotatedAt: row.created_at
  };
}

function createEmptyLiveApiKey() {
  return {
    id: null,
    key: "",
    maskedKey: maskApiKey(""),
    keyPrefix: "",
    oneTimeReveal: false,
    lastUsedAt: null,
    rotatedAt: null
  };
}

function toAuthSession({ user, profile, workspace, mode = "supabase" }) {
  const mappedWorkspace = mapWorkspace(workspace?.workspace || workspace, workspace?.role || "owner");
  const workspaceId = mappedWorkspace?.id || "";

  if (workspaceId) {
    setActiveWorkspaceId(workspaceId);
  }

  return {
    isAuthenticated: Boolean(user),
    isRestoring: false,
    mode,
    workspace: mappedWorkspace,
    workspaceId,
    user: user
      ? {
          id: user.id,
          name: profile?.name || user.user_metadata?.name || nameFromEmail(user.email),
          email: profile?.email || user.email,
          plan: mappedWorkspace?.plan || profile?.plan || "Free"
        }
      : null
  };
}

function toLoggedOutSession(mode = isSupabaseConfigured ? "supabase" : "mock") {
  clearActiveWorkspaceId();
  return {
    isAuthenticated: false,
    isRestoring: false,
    mode,
    user: null,
    workspace: null,
    workspaceId: null
  };
}

function toMockSession(session) {
  if (session.isAuthenticated) {
    setActiveWorkspaceId("demo");
  } else {
    clearActiveWorkspaceId();
  }

  return {
    ...session,
    isRestoring: false,
    mode: "mock",
    workspaceId: session.isAuthenticated ? "demo" : null,
    workspace: session.isAuthenticated
      ? {
          id: "demo",
          name: "Demo Workspace",
          slug: "demo",
          plan: session.user?.plan || "Free",
          role: "owner"
        }
      : null
  };
}

function assertSupabaseAvailable() {
  if (!isSupabaseConfigured && !allowLocalMockFallback) {
    throw new Error("Supabase is required in production. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

export function getInitialSession() {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return toMockSession(mockAuth.getSession());
  }

  if (!isSupabaseConfigured) {
    return toLoggedOutSession("live");
  }

  return {
    isAuthenticated: false,
    isRestoring: true,
    mode: "supabase",
    user: null,
    workspace: null,
    workspaceId: null
  };
}

async function getProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, plan")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureProfile(user, options = {}) {
  const existingProfile = await getProfile(user);

  if (existingProfile) {
    return existingProfile;
  }

  const profile = {
    id: user.id,
    name: options.name || user.user_metadata?.name || nameFromEmail(user.email),
    email: user.email,
    plan: "Free"
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(profile)
    .select("id, name, email, plan")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getFirstWorkspace(userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name, slug, plan)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.workspace ? data : null;
}

async function createWorkspaceBootstrap(user, options = {}) {
  const workspaceName = workspaceNameFromDomain(options.domain, user.email);
  const slugBase = slugify(normalizeDomainInput(options.domain) || user.email);

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name: workspaceName,
      slug: `${slugBase}-${randomSuffix()}`,
      owner_id: user.id,
      plan: "Free"
    })
    .select("id, name, slug, plan")
    .single();

  if (workspaceError) {
    throw workspaceError;
  }

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "owner"
  });

  if (memberError) {
    throw memberError;
  }

  const { error: monetizationError } = await supabase
    .from("monetization_settings")
    .upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" });

  if (monetizationError) {
    throw monetizationError;
  }

  const { error: trainingError } = await supabase
    .from("training_permissions")
    .upsert({ workspace_id: workspace.id }, { onConflict: "workspace_id" });

  if (trainingError) {
    throw trainingError;
  }

  return {
    role: "owner",
    workspace
  };
}

async function ensureAccountBootstrap(user, options = {}) {
  const profile = await ensureProfile(user, options);
  const existingWorkspace = await getFirstWorkspace(user.id);
  const workspace = existingWorkspace || (await createWorkspaceBootstrap(user, options));

  return toAuthSession({ user, profile, workspace });
}

async function getReadySession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.user?.id) {
    return null;
  }

  return session;
}

function bootstrapAfterSessionReady(session, options = {}) {
  if (!session?.user?.id) {
    return null;
  }

  const userId = session.user.id;
  const existingBootstrap = bootstrapPromises.get(userId);

  if (existingBootstrap) {
    return existingBootstrap;
  }

  if (import.meta.env.DEV) {
    console.log("Bootstrap running with user:", userId);
  }

  const bootstrapPromise = ensureAccountBootstrap(session.user, options).finally(() => {
    bootstrapPromises.delete(userId);
  });

  bootstrapPromises.set(userId, bootstrapPromise);
  return bootstrapPromise;
}

export async function restoreSession() {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return toMockSession(mockAuth.getSession());
  }

  assertSupabaseAvailable();

  const session = await getReadySession();

  if (!session?.user) {
    return toLoggedOutSession("supabase");
  }

  try {
    return await bootstrapAfterSessionReady(session);
  } catch {
    return toLoggedOutSession("supabase");
  }
}

export async function login(credentials = {}) {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return toMockSession(mockAuth.login(credentials));
  }

  assertSupabaseAvailable();

  const email = String(credentials.email || "").trim().toLowerCase();
  const password = String(credentials.password || "");

  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message || "Unable to log in.");
  }

  const session = await getReadySession();

  if (!session?.user) {
    throw new Error("Unable to restore your Supabase session.");
  }

  return bootstrapAfterSessionReady(session);
}

export async function signup(credentials = {}) {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return toMockSession(mockAuth.signup(credentials));
  }

  assertSupabaseAvailable();

  const email = String(credentials.email || "").trim().toLowerCase();
  const password = String(credentials.password || "");
  const domain = normalizeDomainInput(credentials.domain);

  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid work email address.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: credentials.name || nameFromEmail(email),
        domain
      }
    }
  });

  if (error) {
    throw new Error(error.message || "Unable to create account.");
  }

  const session = await getReadySession();

  if (!session?.user) {
    throw new Error("Check your email to confirm your account, then log in to finish workspace setup.");
  }

  return bootstrapAfterSessionReady(session, { domain, name: credentials.name });
}

export async function logout() {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return toMockSession(mockAuth.logout());
  }

  if (!isSupabaseConfigured) {
    return toLoggedOutSession("live");
  }

  await supabase.auth.signOut();
  return toLoggedOutSession("supabase");
}

export async function addDomain(domain, workspaceId = getActiveWorkspaceId()) {
  if ((!isSupabaseConfigured || !workspaceId) && allowLocalMockFallback) {
    return null;
  }

  assertSupabaseAvailable();

  if (!workspaceId) {
    throw new Error("Active workspace is required before adding a domain.");
  }

  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    throw new Error("Sign in again before adding a domain.");
  }

  const hostname = normalizeDomainInput(domain);

  if (!hostname) {
    throw new Error("Enter a valid domain.");
  }

  const { data, error } = await supabase
    .from("domains")
    .insert({
      workspace_id: workspaceId,
      hostname,
      status: "pending"
    })
    .select("id, workspace_id, hostname, status, verification_token, verified_at, last_checked_at, created_at")
    .single();

  if (error) {
    throw new Error(error.message || "Domain could not be added.");
  }

  return mapDomain(data);
}

export async function getSettingsOverlay(baseSettings) {
  if (!isSupabaseConfigured && allowLocalMockFallback) {
    return baseSettings;
  }

  assertSupabaseAvailable();

  const session = await restoreSession();

  if (!session.isAuthenticated || !session.workspaceId) {
    throw new Error("A signed-in workspace is required to load production settings.");
  }

  const [domainsResult, apiKeysResult] = await Promise.all([
    supabase
      .from("domains")
      .select("id, workspace_id, hostname, status, verification_token, verified_at, last_checked_at, created_at")
      .eq("workspace_id", session.workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("api_keys")
      .select("id, key_prefix, last_used_at, created_at")
      .eq("workspace_id", session.workspaceId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (domainsResult.error) {
    throw new Error("Domains could not be loaded from Supabase.");
  }

  if (apiKeysResult.error) {
    throw new Error("API key metadata could not be loaded from Supabase.");
  }

  const apiKey = mapApiKey(apiKeysResult.data) || createEmptyLiveApiKey();

  return {
    ...baseSettings,
    workspaceId: session.workspaceId,
    script: buildTrackerSnippet({ workspaceId: session.workspaceId, apiKey: apiKey.key || apiKey.maskedKey }),
    domains: (domainsResult.data || []).map(mapDomain),
    apiKey,
    account: {
      name: session.user.name,
      email: session.user.email,
      plan: session.user.plan
    }
  };
}
