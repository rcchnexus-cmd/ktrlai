import summaryHandler from "./_adminSummaryRoute.js";

function getAction(req) {
  const value = req.query?.action;
  return String(Array.isArray(value) ? value[0] : value || "summary").trim().toLowerCase();
}

export default function handler(req, res) {
  if (getAction(req) !== "summary") {
    return res.status(400).json({
      ok: false,
      message: "Unsupported admin API action."
    });
  }

  return summaryHandler(req, res);
}
