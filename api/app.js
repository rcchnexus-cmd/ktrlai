import apiKeyHandler from "./_apiKeyRoute.js";
import auditHandler from "./_auditRoute.js";
import domainHandler from "./_domainRoute.js";
import notificationHandler from "./_notificationRoute.js";
import teamHandler from "./_teamRoute.js";
import verifyDomainHandler from "./_verifyDomainRoute.js";

const handlers = {
  "api-key": apiKeyHandler,
  audit: auditHandler,
  domain: domainHandler,
  notification: notificationHandler,
  team: teamHandler,
  "verify-domain": verifyDomainHandler
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
      message: "Unsupported app API action."
    });
  }

  return selectedHandler(req, res);
}
