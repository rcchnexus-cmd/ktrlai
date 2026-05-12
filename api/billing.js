import portalHandler from "./_billingPortalRoute.js";
import checkoutHandler from "./_checkoutRoute.js";
import payoutHandler from "./_payoutRoute.js";

const handlers = {
  checkout: checkoutHandler,
  portal: portalHandler,
  payout: payoutHandler
};

function getAction(req) {
  const value = req.query?.action;
  return String(Array.isArray(value) ? value[0] : value || "").trim().toLowerCase();
}

export default function handler(req, res) {
  const action = getAction(req);
  const selectedHandler = handlers[action];

  if (!selectedHandler) {
    return res.status(400).json({
      ok: false,
      message: "Unsupported billing API action."
    });
  }

  return selectedHandler(req, res);
}
