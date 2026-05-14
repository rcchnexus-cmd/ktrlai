import {
  getEmailProviderName,
  getSupportEmailAddress,
  sendEmail,
} from "./_emailProvider.js";
import { enqueueJob } from "./_jobs.js";
import { jobTypes } from "./_jobTypes.js";

export const notificationEventTypes = {
  welcome: "welcome",
  installVerified: "install_verified",
  billingActivated: "billing_activated",
  paymentFailed: "payment_failed",
  suspiciousCrawlerDetected: "suspicious_crawler_detected",
  teamInvite: "team_invite",
};

export const notificationPreferenceDefaults = {
  emailNotifications: true,
  installVerified: true,
  billingAlerts: true,
  suspiciousCrawlerAlerts: true,
  teamInviteEmails: true,
};

const preferenceByType = {
  [notificationEventTypes.installVerified]: "installVerified",
  [notificationEventTypes.billingActivated]: "billingAlerts",
  [notificationEventTypes.paymentFailed]: "billingAlerts",
  [notificationEventTypes.suspiciousCrawlerDetected]: "suspiciousCrawlerAlerts",
  [notificationEventTypes.teamInvite]: "teamInviteEmails",
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeMetadata(metadata = {}) {
  const safe = {};

  for (const [key, value] of Object.entries(metadata || {})) {
    if (/key|secret|token|hash/i.test(key)) {
      safe[key] = "[redacted]";
    } else if (typeof value === "string") {
      safe[key] = value.slice(0, 500);
    } else {
      safe[key] = value;
    }
  }

  return safe;
}

function safeErrorMessage(error) {
  const message = error?.message || String(error || "Notification error");
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 300);
}

function mergePreferences(preferences = {}) {
  return {
    ...notificationPreferenceDefaults,
    ...(preferences || {}),
  };
}

function buildShell({ title, intro, body, ctaLabel, ctaUrl }) {
  const safeTitle = escapeHtml(title);
  const bodyBlocks = [intro, body].filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const cta = ctaUrl
    ? `<p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,#5B8CFF,#9B6DFF);color:#fff;text-decoration:none;border-radius:10px;padding:12px 16px;font-weight:700;">${escapeHtml(ctaLabel || "Open KtrlAI")}</a></p>`
    : "";

  return `
    <div style="margin:0;padding:0;background:#070B14;color:#FFFFFF;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="font-size:18px;font-weight:800;margin-bottom:24px;">
          <span style="color:#fff;">Ktrl</span><span style="background:linear-gradient(135deg,#5B8CFF,#9B6DFF);-webkit-background-clip:text;background-clip:text;color:transparent;">AI</span>
        </div>
        <div style="border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);border-radius:18px;padding:28px;">
          <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">${safeTitle}</h1>
          <div style="color:#D1D5DB;font-size:15px;line-height:1.7;">${bodyBlocks}${cta}</div>
        </div>
        <p style="color:#9CA3AF;font-size:12px;line-height:1.6;margin-top:18px;">
          You received this because notifications are enabled for your KtrlAI workspace.
          Need help? Contact ${escapeHtml(getSupportEmailAddress())}.
        </p>
      </div>
    </div>
  `;
}

async function logNotificationEvent(
  supabase,
  {
    workspaceId,
    userId,
    type,
    recipientEmail,
    status,
    provider,
    providerMessageId,
    errorMessage,
    metadata,
    sentAt,
  },
) {
  if (!supabase || !workspaceId || !type || !recipientEmail) {
    return { ok: false, skipped: true, reason: "missing_log_context" };
  }

  const { data, error } = await supabase
    .from("notification_events")
    .insert({
      workspace_id: workspaceId,
      user_id: userId || null,
      type,
      recipient_email: recipientEmail,
      status,
      provider: provider || getEmailProviderName(),
      provider_message_id: providerMessageId || null,
      error_message: errorMessage || null,
      metadata: sanitizeMetadata(metadata),
      sent_at: sentAt || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: safeErrorMessage(error) };
  }

  return { ok: true, id: data?.id || null };
}

async function updateNotificationEvent(
  supabase,
  notificationEventId,
  { status, provider, providerMessageId, errorMessage, metadata, sentAt } = {},
) {
  if (!supabase || !notificationEventId) {
    return { ok: false, skipped: true, reason: "missing_notification_event_id" };
  }

  const { error } = await supabase
    .from("notification_events")
    .update({
      ...(status ? { status } : {}),
      ...(provider ? { provider } : {}),
      ...(providerMessageId ? { provider_message_id: providerMessageId } : {}),
      error_message: errorMessage || null,
      ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
      sent_at: sentAt || null,
    })
    .eq("id", notificationEventId);

  if (error) {
    return { ok: false, error: safeErrorMessage(error) };
  }

  return { ok: true };
}

async function hasRecentNotification(supabase, { workspaceId, type, recipientEmail, hours }) {
  if (!supabase || !workspaceId || !type || !hours) {
    return false;
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from("notification_events")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1);

  if (recipientEmail) {
    query = query.eq("recipient_email", recipientEmail);
  }

  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data?.id);
}

export async function getWorkspaceNotificationPreferences(supabase, workspaceId) {
  if (!supabase || !workspaceId) {
    return notificationPreferenceDefaults;
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("notification_preferences")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    return notificationPreferenceDefaults;
  }

  return mergePreferences(data.notification_preferences);
}

export async function updateWorkspaceNotificationPreferences(supabase, workspaceId, preferences) {
  const nextPreferences = mergePreferences(preferences);
  const { data, error } = await supabase
    .from("workspaces")
    .update({ notification_preferences: nextPreferences, updated_at: new Date().toISOString() })
    .eq("id", workspaceId)
    .select("notification_preferences")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mergePreferences(data?.notification_preferences);
}

export async function getWorkspaceNotificationRecipients(supabase, workspaceId) {
  if (!supabase || !workspaceId) {
    return [];
  }

  const membersResult = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin"]);

  const members = membersResult.data || [];
  const userIds = [...new Set(members.map((member) => member.user_id).filter(Boolean))];

  if (!userIds.length) {
    return [];
  }

  const profilesResult = await supabase
    .from("profiles")
    .select("id, email, name")
    .in("id", userIds);

  const profiles = profilesResult.data || [];
  return profiles
    .filter((profile) => profile.email)
    .map((profile) => ({
      userId: profile.id,
      email: profile.email,
      name: profile.name || profile.email,
      role: members.find((member) => member.user_id === profile.id)?.role || "admin",
    }));
}

export async function getWorkspaceName(supabase, workspaceId) {
  if (!supabase || !workspaceId) {
    return "your workspace";
  }

  const { data } = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  return data?.name || "your workspace";
}

export async function sendNotification(
  supabase,
  {
    workspaceId,
    userId,
    to,
    type,
    subject,
    html,
    text,
    metadata = {},
    preferenceKey,
    dedupeHours,
    force = false,
  },
) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  const prefKey = preferenceKey || preferenceByType[type];
  const preferences = await getWorkspaceNotificationPreferences(supabase, workspaceId);

  if (!force && (!preferences.emailNotifications || (prefKey && preferences[prefKey] === false))) {
    await Promise.all(
      recipients.map((recipient) =>
        logNotificationEvent(supabase, {
          workspaceId,
          userId,
          type,
          recipientEmail: recipient,
          status: "skipped",
          provider: getEmailProviderName(),
          errorMessage: "Notification preference disabled.",
          metadata,
        }),
      ),
    );
    return { ok: true, skipped: true, reason: "preference_disabled" };
  }

  const results = [];

  for (const recipient of recipients) {
    if (dedupeHours && (await hasRecentNotification(supabase, { workspaceId, type, recipientEmail: recipient, hours: dedupeHours }))) {
      await logNotificationEvent(supabase, {
        workspaceId,
        userId,
        type,
        recipientEmail: recipient,
        status: "skipped",
        provider: getEmailProviderName(),
        errorMessage: "Duplicate notification skipped.",
        metadata,
      });
      results.push({ ok: true, skipped: true, recipient, reason: "dedupe" });
      continue;
    }

    const queuedEvent = await logNotificationEvent(supabase, {
      workspaceId,
      userId,
      type,
      recipientEmail: recipient,
      status: "queued",
      provider: getEmailProviderName(),
      metadata,
    });

    const job = await enqueueJob(supabase, {
      type: jobTypes.sendEmail,
      payload: {
        notificationEventId: queuedEvent.id || null,
        workspaceId,
        userId,
        recipientEmail: recipient,
        notificationType: type,
        subject,
        html,
        text,
        metadata,
      },
      maxAttempts: 3,
    });

    if (!job.ok && queuedEvent.id) {
      await updateNotificationEvent(supabase, queuedEvent.id, {
        status: "failed",
        provider: getEmailProviderName(),
        errorMessage: "Notification job could not be queued.",
        metadata: { ...metadata, queueError: job.errorMessage || job.reason },
      });
    }

    results.push({
      ok: job.ok,
      queued: job.ok,
      recipient,
      status: job.ok ? "queued" : "failed",
      jobId: job.job?.id || null,
      reason: job.reason || null,
    });
  }

  return { ok: results.every((result) => result.ok), results };
}

export async function processQueuedEmailNotification(supabase, payload = {}) {
  const notificationEventId = payload.notificationEventId || null;
  const metadata = payload.metadata || {};
  const result = await sendEmail({
    to: payload.recipientEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    type: payload.notificationType,
    workspaceId: payload.workspaceId,
    userId: payload.userId,
  });
  const status = result.ok && !result.skipped ? "sent" : result.ok ? "skipped" : "failed";

  if (notificationEventId) {
    await updateNotificationEvent(supabase, notificationEventId, {
      status,
      provider: result.provider || getEmailProviderName(),
      providerMessageId: result.providerMessageId,
      errorMessage: result.reason || result.errorMessage || null,
      metadata: { ...metadata, providerMetadata: result.metadata },
      sentAt: status === "sent" ? new Date().toISOString() : null,
    });
  }

  return result.ok
    ? { ok: true, status, provider: result.provider || getEmailProviderName() }
    : { ok: false, status, errorMessage: result.errorMessage || result.reason || "Email provider failed." };
}

export async function sendWelcomeEmail(supabase, { workspaceId, userId, email, name, workspaceName }) {
  const displayName = name || "there";
  const workspace = workspaceName || (await getWorkspaceName(supabase, workspaceId));
  return sendNotification(supabase, {
    workspaceId,
    userId,
    to: email,
    type: notificationEventTypes.welcome,
    subject: "Welcome to KtrlAI",
    text: `Welcome to KtrlAI, ${displayName}. Your ${workspace} workspace is ready for AI visibility, controls, and monetization.`,
    html: buildShell({
      title: "Welcome to KtrlAI",
      intro: `Hi ${displayName}, your ${workspace} workspace is ready.`,
      body: "Generate an API key, install the tracker, and your live AI access events will start appearing in KtrlAI.",
      ctaLabel: "Open setup",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/settings` : undefined,
    }),
    metadata: { workspaceName: workspace },
    dedupeHours: 24,
    force: true,
  });
}

export async function sendInstallVerifiedEmail(supabase, { workspaceId, activityLogId, pagePath }) {
  const workspace = await getWorkspaceName(supabase, workspaceId);
  const recipients = await getWorkspaceNotificationRecipients(supabase, workspaceId);

  return sendNotification(supabase, {
    workspaceId,
    to: recipients.map((recipient) => recipient.email),
    type: notificationEventTypes.installVerified,
    subject: "KtrlAI tracker connected",
    text: `KtrlAI is now receiving live events for ${workspace}. First event: ${pagePath || "your site"}.`,
    html: buildShell({
      title: "Tracker connected successfully",
      intro: `KtrlAI is now receiving live events for ${workspace}.`,
      body: `First event received from ${pagePath || "your site"}. You can now monitor AI access and crawler activity.`,
      ctaLabel: "View activity",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/activity` : undefined,
    }),
    metadata: { activityLogId, pagePath, workspaceName: workspace },
    dedupeHours: 720,
  });
}

export async function sendBillingActivatedEmail(supabase, { workspaceId, plan }) {
  const workspace = await getWorkspaceName(supabase, workspaceId);
  const recipients = await getWorkspaceNotificationRecipients(supabase, workspaceId);

  return sendNotification(supabase, {
    workspaceId,
    to: recipients.map((recipient) => recipient.email),
    type: notificationEventTypes.billingActivated,
    subject: `Your KtrlAI ${plan} plan is active`,
    text: `Billing is active for ${workspace}. Your workspace is now on the ${plan} plan.`,
    html: buildShell({
      title: "Billing activated",
      intro: `${workspace} is now on the ${plan} plan.`,
      body: "Your plan limits and subscription status have been updated in KtrlAI.",
      ctaLabel: "Manage billing",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/settings` : undefined,
    }),
    metadata: { workspaceName: workspace, plan },
    dedupeHours: 12,
  });
}

export async function sendPaymentFailedEmail(supabase, { workspaceId, amountDue }) {
  const workspace = await getWorkspaceName(supabase, workspaceId);
  const recipients = await getWorkspaceNotificationRecipients(supabase, workspaceId);

  return sendNotification(supabase, {
    workspaceId,
    to: recipients.map((recipient) => recipient.email),
    type: notificationEventTypes.paymentFailed,
    subject: "KtrlAI payment failed",
    text: `A KtrlAI payment failed for ${workspace}. Please update billing details to avoid subscription interruption.`,
    html: buildShell({
      title: "Payment needs attention",
      intro: `A payment failed for ${workspace}.`,
      body: "Update billing details in KtrlAI to keep your subscription active.",
      ctaLabel: "Open billing",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/settings` : undefined,
    }),
    metadata: { workspaceName: workspace, amountDue },
    dedupeHours: 12,
  });
}

export async function sendSuspiciousCrawlerEmail(
  supabase,
  { workspaceId, activityLogId, botName, pagePath, confidenceScore },
) {
  const workspace = await getWorkspaceName(supabase, workspaceId);
  const recipients = await getWorkspaceNotificationRecipients(supabase, workspaceId);

  return sendNotification(supabase, {
    workspaceId,
    to: recipients.map((recipient) => recipient.email),
    type: notificationEventTypes.suspiciousCrawlerDetected,
    subject: "Suspicious crawler activity detected",
    text: `KtrlAI detected suspicious crawler activity on ${pagePath || "your site"} in ${workspace}.`,
    html: buildShell({
      title: "Suspicious crawler activity detected",
      intro: `KtrlAI detected ${botName || "a suspicious crawler"} in ${workspace}.`,
      body: `Review the event for ${pagePath || "your site"} and adjust governance policies if needed.`,
      ctaLabel: "Review activity",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/activity` : undefined,
    }),
    metadata: { workspaceName: workspace, activityLogId, botName, pagePath, confidenceScore },
    dedupeHours: 6,
  });
}

export async function sendTeamInviteEmail(
  supabase,
  { workspaceId, email, role, inviterEmail, invitationId },
) {
  const workspace = await getWorkspaceName(supabase, workspaceId);

  return sendNotification(supabase, {
    workspaceId,
    to: email,
    type: notificationEventTypes.teamInvite,
    subject: `You're invited to ${workspace} on KtrlAI`,
    text: `${inviterEmail || "A teammate"} invited you to join ${workspace} on KtrlAI as ${role}.`,
    html: buildShell({
      title: "You have a KtrlAI team invitation",
      intro: `${inviterEmail || "A teammate"} invited you to join ${workspace}.`,
      body: `Your role will be ${role}. Sign in to KtrlAI with this email address to accept access when invitation acceptance is enabled.`,
      ctaLabel: "Open KtrlAI",
      ctaUrl: process.env.APP_URL ? `${process.env.APP_URL}/login` : undefined,
    }),
    metadata: { workspaceName: workspace, role, invitationId },
    preferenceKey: "teamInviteEmails",
    dedupeHours: 1,
  });
}
