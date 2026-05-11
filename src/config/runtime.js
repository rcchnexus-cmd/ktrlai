const viteEnv = import.meta.env || {};

export const isProductionApp = Boolean(viteEnv.PROD);
export const allowLocalMockFallback = !isProductionApp;
export const showInvestorSampleData = viteEnv.VITE_SHOW_INVESTOR_SAMPLE_DATA !== "false";

export function getPublicAppUrl() {
  const configuredUrl = String(viteEnv.VITE_APP_URL || "").replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "https://ktrlai.vercel.app";
}

export function getTrackerInstallUrl() {
  return String(viteEnv.VITE_TRACKER_URL || viteEnv.VITE_APP_URL || "https://ktrlai.vercel.app").replace(/\/$/, "");
}
