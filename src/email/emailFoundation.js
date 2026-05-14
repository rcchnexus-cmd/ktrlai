export const emailEventTypes = Object.freeze({
  welcome: "welcome",
  installVerified: "install_verified",
  billingActivated: "billing_activated",
  paymentFailed: "payment_failed",
  suspiciousCrawlerDetected: "suspicious_crawler_detected",
  teamInvite: "team_invite"
});

export const notificationPreferenceDefaults = Object.freeze({
  emailNotifications: true,
  installVerified: true,
  billingAlerts: true,
  suspiciousCrawlerAlerts: true,
  teamInviteEmails: true
});

export function createNoopEmailProvider() {
  return {
    name: "noop",
    async send(message) {
      return {
        ok: true,
        provider: "noop",
        messageId: `noop_${message.eventType}_${Date.now()}`
      };
    }
  };
}

export function createEmailService(provider = createNoopEmailProvider()) {
  const queueEvent = async (eventType, payload = {}) => {
    const message = buildEmailMessage(eventType, payload);
    return provider.send(message);
  };

  return {
    providerName: provider.name || "custom",
    queueEvent,
    welcomeEmail: (payload) => queueEvent(emailEventTypes.welcome, payload),
    installVerified: (payload) => queueEvent(emailEventTypes.installVerified, payload),
    billingActivated: (payload) => queueEvent(emailEventTypes.billingActivated, payload),
    paymentFailed: (payload) => queueEvent(emailEventTypes.paymentFailed, payload),
    suspiciousCrawlerDetected: (payload) => queueEvent(emailEventTypes.suspiciousCrawlerDetected, payload),
    teamInvite: (payload) => queueEvent(emailEventTypes.teamInvite, payload)
  };
}

export function buildEmailMessage(eventType, payload = {}) {
  const workspaceName = payload.workspaceName || "your KtrlAI workspace";

  const templates = {
    [emailEventTypes.welcome]: {
      subject: "Welcome to KtrlAI",
      preview: "Your AI governance workspace is ready."
    },
    [emailEventTypes.installVerified]: {
      subject: "KtrlAI tracker connected",
      preview: `KtrlAI is receiving live events for ${workspaceName}.`
    },
    [emailEventTypes.billingActivated]: {
      subject: "KtrlAI billing activated",
      preview: `Billing is active for ${workspaceName}.`
    },
    [emailEventTypes.paymentFailed]: {
      subject: "KtrlAI billing needs attention",
      preview: `A payment for ${workspaceName} could not be completed.`
    },
    [emailEventTypes.suspiciousCrawlerDetected]: {
      subject: "Suspicious crawler activity detected",
      preview: `KtrlAI detected suspicious access patterns for ${workspaceName}.`
    },
    [emailEventTypes.teamInvite]: {
      subject: `You're invited to ${workspaceName} on KtrlAI`,
      preview: "A teammate invited you to join a KtrlAI workspace."
    }
  };

  const template = templates[eventType] || {
    subject: "KtrlAI notification",
    preview: "A KtrlAI workspace event needs attention."
  };

  return {
    eventType,
    to: payload.to || payload.email || "",
    subject: template.subject,
    preview: template.preview,
    payload,
    createdAt: new Date().toISOString()
  };
}
