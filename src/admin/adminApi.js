import { getSupabaseAccessToken } from "../lib/supabaseClient.js";

class AdminApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function requestAdminSummary(search = "") {
  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    throw new AdminApiError("Sign in with a platform admin account to access this area.", 401);
  }

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("action", "summary");
  const response = await fetch(`/api/admin?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok || data.ok === false) {
    throw new AdminApiError(data.message || "Admin data could not be loaded.", response.status);
  }

  return data;
}

export async function checkPlatformAdminAccess() {
  try {
    const data = await requestAdminSummary("?scope=access");
    return Boolean(data.isPlatformAdmin);
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 500) {
      return false;
    }

    throw error;
  }
}

export async function getAdminSummary() {
  return requestAdminSummary("");
}
