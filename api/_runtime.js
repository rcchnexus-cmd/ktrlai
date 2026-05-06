export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function allowLocalMockFallback() {
  return !isProductionRuntime();
}

export function getAppUrl(req) {
  const configuredUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  if (isProductionRuntime()) {
    return "https://ktrlai.vercel.app";
  }

  const protocol = req?.headers?.["x-forwarded-proto"] || "http";
  const host = req?.headers?.host || "localhost:5173";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

export function sendMissingServerConfig(res) {
  return res.status(500).json({
    ok: false,
    mode: "live",
    message: "Server configuration missing."
  });
}
