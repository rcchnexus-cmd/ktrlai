const DEFAULT_PROVIDER = "noop";

function normalizeProviderName() {
  return String(process.env.EMAIL_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
}

function getFromAddress() {
  return process.env.EMAIL_FROM || "KtrlAI <notifications@ktrlai.com>";
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || "support@ktrlai.com";
}

function safeProviderError(error) {
  const message = error?.message || String(error || "Unknown email provider error");
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 300);
}

function normalizeRecipients(to) {
  if (Array.isArray(to)) {
    return to.filter(Boolean);
  }

  return to ? [to] : [];
}

function isConfiguredForProvider(provider) {
  if (provider === "resend") {
    return Boolean(process.env.RESEND_API_KEY);
  }

  if (provider === "sendgrid") {
    return Boolean(process.env.SENDGRID_API_KEY);
  }

  if (provider === "postmark") {
    return Boolean(process.env.POSTMARK_SERVER_TOKEN);
  }

  return false;
}

async function sendWithResend(message) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: normalizeRecipients(message.to),
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Resend rejected the email request.");
  }

  return {
    ok: true,
    provider: "resend",
    providerMessageId: payload?.id || null,
  };
}

async function sendWithUnsupportedProvider(provider) {
  return {
    ok: true,
    skipped: true,
    provider,
    reason: `${provider}_provider_not_implemented`,
  };
}

export function getEmailProviderName() {
  return normalizeProviderName();
}

export function getEmailFrom() {
  return getFromAddress();
}

export function getSupportEmailAddress() {
  return getSupportEmail();
}

export function isEmailProviderConfigured() {
  return isConfiguredForProvider(normalizeProviderName());
}

export function getEmailProviderStatus() {
  const provider = normalizeProviderName();

  return {
    provider,
    configured: isConfiguredForProvider(provider),
    from: getFromAddress(),
    supportEmail: getSupportEmail(),
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  type,
  workspaceId,
  userId,
  from = getFromAddress(),
}) {
  const provider = normalizeProviderName();
  const recipients = normalizeRecipients(to);

  if (!recipients.length) {
    return {
      ok: false,
      skipped: true,
      provider,
      reason: "missing_recipient",
    };
  }

  if (!subject || (!html && !text)) {
    return {
      ok: false,
      skipped: true,
      provider,
      reason: "missing_message_content",
    };
  }

  if (!isConfiguredForProvider(provider)) {
    return {
      ok: true,
      skipped: true,
      provider: "noop",
      reason: "email_not_configured",
      metadata: { requestedProvider: provider, type, workspaceId, userId },
    };
  }

  const message = {
    to: recipients,
    from,
    subject,
    html,
    text,
    type,
    workspaceId,
    userId,
  };

  try {
    if (provider === "resend") {
      return await sendWithResend(message);
    }

    return await sendWithUnsupportedProvider(provider);
  } catch (error) {
    return {
      ok: false,
      provider,
      errorMessage: safeProviderError(error),
    };
  }
}
