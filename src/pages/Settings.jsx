import { useEffect, useState } from "react";
import { getWorkspaceInstallHealth } from "../analytics/analyticsApi.js";
import AppShell from "../components/AppShell.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { billingPlans, normalizePlan } from "../billing/stripeConfig.js";
import { openBillingPortal, startBillingCheckout } from "../billing/billingApi.js";
import { getTrackerInstallUrl } from "../config/runtime.js";
import { useApp } from "../context/AppContext.jsx";
import {
  buildDnsRecord,
  createLocalEnterpriseSettings,
  inviteWorkspaceMember,
  loadEnterpriseSettings,
  maskApiKey,
  mergeDomainVerificationResult,
  notificationPreferenceDefaults,
  removeWorkspaceMember,
  rotateApiKeyWithApi,
  saveGovernancePolicy,
  saveNotificationPreferences,
  updateWorkspaceMemberRole,
  verifyDomainWithApi
} from "../settings/securityUtils.js";

const installMethods = [
  { id: "html", label: "HTML script" },
  { id: "react", label: "React/Vite" },
  { id: "next", label: "Next.js" },
  { id: "wordpress", label: "WordPress" },
  { id: "webflow", label: "Webflow" },
  { id: "shopify", label: "Shopify" }
];

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

const billingWarningStatuses = new Set(["canceled", "past_due", "incomplete", "incomplete_expired", "unpaid"]);

function formatSubscriptionStatus(value) {
  return String(value || "free").replace(/_/g, " ");
}

function formatRenewalDate(value) {
  return value ? formatDate(value) : "Not scheduled";
}

function formatDateTime(value) {
  if (!value) {
    return "No events yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function fallbackCopyToClipboard(value) {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function getInstallStatusLabel(status) {
  const labels = {
    not_installed: "Not installed",
    pending: "Waiting for first event",
    active: "Tracker active",
    inactive: "Inactive"
  };

  return labels[status] || "Waiting for first event";
}

function getInstallStepState({ step, hasKey, hasSnippetKey, installStatus }) {
  if (step === "key") {
    return hasKey ? "complete" : "current";
  }

  if (step === "install") {
    if (!hasKey) return "pending";
    if (installStatus === "active" || installStatus === "inactive") return "complete";
    return hasSnippetKey ? "current" : "pending";
  }

  if (installStatus === "active") {
    return "complete";
  }

  return hasKey ? "current" : "pending";
}

function getInstallSnippet(method, { appUrl, workspaceId, apiKey }) {
  const scriptTag = `<script async src="${appUrl}/tracker.js" data-workspace-id="${workspaceId}" data-api-key="${apiKey}" data-endpoint="${appUrl}/api/track"></script>`;
  const examples = {
    html: {
      title: "Paste before the closing </head> tag",
      detail: "Best for static sites, custom HTML, and tag managers.",
      code: scriptTag
    },
    react: {
      title: "Load once in your React app shell",
      detail: "Use in App.jsx, main layout, or another component that mounts once.",
      code: `import { useEffect } from "react";

export function KtrlAITracker() {
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "${appUrl}/tracker.js";
    script.dataset.workspaceId = "${workspaceId}";
    script.dataset.apiKey = "${apiKey}";
    script.dataset.endpoint = "${appUrl}/api/track";
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return null;
}`
    },
    next: {
      title: "Add to your root layout",
      detail: "Works with the Next.js Script component after the page becomes interactive.",
      code: `import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${appUrl}/tracker.js"
          strategy="afterInteractive"
          data-workspace-id="${workspaceId}"
          data-api-key="${apiKey}"
          data-endpoint="${appUrl}/api/track"
        />
      </body>
    </html>
  );
}`
    },
    wordpress: {
      title: "Add through your theme or header plugin",
      detail: "Place this in a header injection plugin, or enqueue it from your theme.",
      code: `add_action('wp_head', function () {
  echo '${scriptTag.replace(/'/g, "\\'")}';
});`
    },
    webflow: {
      title: "Add to Custom Code",
      detail: "Paste this in Project Settings -> Custom Code -> Head Code.",
      code: scriptTag
    },
    shopify: {
      title: "Add to theme.liquid",
      detail: "Paste before </head> in your active theme, then publish the theme.",
      code: scriptTag
    }
  };

  return examples[method] || examples.html;
}

export default function Settings() {
  const { state, actions } = useApp();
  const settings = state.settings;
  const [domain, setDomain] = useState("");
  const [copiedItem, setCopiedItem] = useState("");
  const [checkingDomainId, setCheckingDomainId] = useState("");
  const [verificationMessages, setVerificationMessages] = useState({});
  const [domainMessage, setDomainMessage] = useState("");
  const [apiKeyMessage, setApiKeyMessage] = useState("");
  const [apiKeyMessageType, setApiKeyMessageType] = useState("success");
  const [revealedApiKey, setRevealedApiKey] = useState(false);
  const [oneTimeApiKey, setOneTimeApiKey] = useState("");
  const [rotatingKey, setRotatingKey] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingMessageType, setBillingMessageType] = useState("success");
  const [billingLoadingPlan, setBillingLoadingPlan] = useState("");
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
  const [installMethod, setInstallMethod] = useState("html");
  const [installHealth, setInstallHealth] = useState(null);
  const [installHealthError, setInstallHealthError] = useState("");
  const [installHealthLoading, setInstallHealthLoading] = useState(false);
  const [enterprise, setEnterprise] = useState(null);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [enterpriseMessage, setEnterpriseMessage] = useState("");
  const [enterpriseMessageType, setEnterpriseMessageType] = useState("success");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [savingPolicyKey, setSavingPolicyKey] = useState("");
  const [savingNotifications, setSavingNotifications] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationMessageType, setNotificationMessageType] = useState("success");

  useEffect(() => {
    if (!state.settings && !state.loading.settings) {
      actions.loadSettings();
    }
  }, [actions, state.loading.settings, state.settings]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !settings?.workspaceId) {
      return undefined;
    }

    let isMounted = true;
    let intervalId;

    const loadInstallHealth = async ({ quiet = false } = {}) => {
      if (!quiet) {
        setInstallHealthLoading(true);
      }

      try {
        const installHealthSummary = await getWorkspaceInstallHealth({
          workspaceId: settings.workspaceId
        });

        if (isMounted) {
          setInstallHealth(installHealthSummary || null);
          setInstallHealthError("");
        }
      } catch (error) {
        if (isMounted) {
          setInstallHealthError(error.message || "Install health is not available yet.");
        }
      } finally {
        if (isMounted && !quiet) {
          setInstallHealthLoading(false);
        }
      }
    };

    loadInstallHealth();
    intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadInstallHealth({ quiet: true });
      }
    }, 45000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [settings?.workspaceId, state.auth.isAuthenticated]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !settings?.workspaceId) {
      return;
    }

    let isMounted = true;

    const loadEnterprise = async () => {
      setEnterpriseLoading(true);
      setEnterpriseMessage("");

      try {
        const data = await loadEnterpriseSettings({ workspaceId: settings.workspaceId });

        if (isMounted) {
          setEnterprise(data);
        }
      } catch (error) {
        if (isMounted && error.useMockFallback) {
          setEnterprise(createLocalEnterpriseSettings());
          setEnterpriseMessage("Enterprise controls are using local development data.");
          setEnterpriseMessageType("success");
        } else if (isMounted) {
          setEnterpriseMessage(error.message || "Enterprise workspace controls could not be loaded.");
          setEnterpriseMessageType("error");
        }
      } finally {
        if (isMounted) {
          setEnterpriseLoading(false);
        }
      }
    };

    loadEnterprise();

    return () => {
      isMounted = false;
    };
  }, [settings?.workspaceId, state.auth.isAuthenticated]);

  const settingsError = state.errors.settings;
  const billing = settings?.billing || {};
  const currentPlan = billing.plan || settings?.account?.plan || "Free";
  const normalizedCurrentPlan = normalizePlan(currentPlan);
  const subscriptionStatus = billing.subscriptionStatus || (normalizedCurrentPlan === "free" ? "free" : "active");
  const subscriptionStatusKey = String(subscriptionStatus || "free").toLowerCase();
  const hasBillingPortal = Boolean(billing.hasStripeCustomer);
  const showBillingWarning = billingWarningStatuses.has(subscriptionStatusKey);
  const fallbackWorkspaceRole = String(state.auth.workspace?.role || "viewer").toLowerCase();
  const fallbackCanManageTeam = fallbackWorkspaceRole === "owner";
  const fallbackCanManageOperations = fallbackWorkspaceRole === "owner" || fallbackWorkspaceRole === "admin";
  const enterprisePermissions = enterprise?.permissions || {
    canManageTeam: fallbackCanManageTeam,
    canManageOperations: fallbackCanManageOperations,
    canViewSecurity: fallbackCanManageOperations,
    canViewBilling: fallbackCanManageOperations
  };
  const currentWorkspaceRole = enterprise?.currentMemberRole || fallbackWorkspaceRole || (enterpriseLoading ? "checking role" : "limited");
  const canManageTeam = Boolean(enterprisePermissions.canManageTeam);
  const canManageOperations = Boolean(enterprisePermissions.canManageOperations);
  const canViewSecurity = Boolean(enterprisePermissions.canViewSecurity);
  const canViewBilling = Boolean(enterprisePermissions.canViewBilling);
  const notificationPreferences = {
    ...notificationPreferenceDefaults,
    ...(enterprise?.notificationPreferences || {})
  };

  const copyValue = async (value, itemKey) => {
    if (!value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopyToClipboard(value)) {
        throw new Error("Clipboard unavailable.");
      }

      setCopiedItem(itemKey);
      window.setTimeout(() => setCopiedItem(""), 1500);
    } catch {
      if (fallbackCopyToClipboard(value)) {
        setCopiedItem(itemKey);
        window.setTimeout(() => setCopiedItem(""), 1500);
      }
    }
  };

  const addDomain = async () => {
    if (domain.trim()) {
      setDomainMessage("");
      try {
        await actions.addDomain(domain.trim());
        setDomain("");
      } catch (error) {
        setDomainMessage(error.message || "Domain could not be added.");
      }
    }
  };

  const checkDomain = async (domainId) => {
    setCheckingDomainId(domainId);
    try {
      const currentDomain = settings.domains.find((item) => item.id === domainId);
      const result = await verifyDomainWithApi({
        domainId,
        workspaceId: settings.workspaceId || "demo"
      });

      if (result.domain && currentDomain) {
        actions.applyDomainVerification(mergeDomainVerificationResult(currentDomain, result.domain));
      }

      setVerificationMessages((messages) => ({
        ...messages,
        [domainId]: result.message || "Domain verification checked."
      }));
    } catch (error) {
      if (error.useMockFallback) {
        const verified = await actions.checkDomainVerification(domainId);
        actions.applyDomainVerification(verified);
      }
      setVerificationMessages((messages) => ({
        ...messages,
        [domainId]:
          error.useMockFallback
            ? "Domain verification accepted in local development mode."
            : error.message || "Domain verification could not be completed."
      }));
    } finally {
      setCheckingDomainId("");
    }
  };

  const rotateApiKey = async () => {
    const hasExistingKey = Boolean(settings?.apiKey?.id || settings?.apiKey?.keyPrefix || settings?.apiKey?.key);
    const action = hasExistingKey ? "rotate" : "generate";

    setRotatingKey(true);
    setRevealedApiKey(false);
    setOneTimeApiKey("");
    setApiKeyMessage("");
    setApiKeyMessageType("success");

    try {
      let result;

      try {
        result = await rotateApiKeyWithApi({ workspaceId: settings.workspaceId || "demo", action });
        actions.applyApiKeyRotation(result);
      } catch (error) {
        if (!error.useMockFallback) {
          throw error;
        }
        result = await actions.rotateApiKey();
      }

      const generatedKey = result.apiKey?.key || "";
      setOneTimeApiKey(generatedKey);
      setRevealedApiKey(Boolean(generatedKey));
      setApiKeyMessageType("success");
      setApiKeyMessage(
        generatedKey
          ? "API key generated. Copy it now; it will be masked after refresh."
          : "API key updated. Only the masked key is available."
      );
    } catch (error) {
      setApiKeyMessageType("error");
      setApiKeyMessage(error.message || "API key could not be rotated.");
    } finally {
      setRotatingKey(false);
    }
  };

  const handlePlanSelect = async (planKey) => {
    if (!settings?.workspaceId) {
      setBillingMessageType("error");
      setBillingMessage("A workspace is required before changing plans.");
      return;
    }

    setBillingMessage("");
    setBillingMessageType("success");
    setBillingLoadingPlan(planKey);

    const result = await startBillingCheckout({
      planKey,
      user: state.auth.user,
      workspaceId: settings.workspaceId
    });

    setBillingMessage(result.message || "");
    setBillingMessageType(result.ok ? "success" : "error");
    setBillingLoadingPlan("");
  };

  const handleManageBilling = async () => {
    if (!settings?.workspaceId) {
      setBillingMessageType("error");
      setBillingMessage("A workspace is required before opening billing.");
      return;
    }

    setBillingMessage("");
    setBillingMessageType("success");
    setOpeningBillingPortal(true);

    const result = await openBillingPortal({ workspaceId: settings.workspaceId });

    setBillingMessage(result.message || "");
    setBillingMessageType(result.ok ? "success" : "error");
    setOpeningBillingPortal(false);
  };

  const reloadEnterprise = async () => {
    if (!settings?.workspaceId) {
      return;
    }

    setEnterpriseLoading(true);
    try {
      const data = await loadEnterpriseSettings({ workspaceId: settings.workspaceId });
      setEnterprise(data);
    } catch (error) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage(error.message || "Enterprise controls could not be refreshed.");
    } finally {
      setEnterpriseLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!settings?.workspaceId || !inviteEmail.trim()) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage("Enter an email address before sending an invitation.");
      return;
    }

    setEnterpriseLoading(true);
    setEnterpriseMessage("");

    try {
      await inviteWorkspaceMember({
        workspaceId: settings.workspaceId,
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteEmail("");
      setInviteRole("viewer");
      setEnterpriseMessageType("success");
      setEnterpriseMessage("Invitation created.");
      await reloadEnterprise();
    } catch (error) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage(error.message || "Invitation could not be created.");
    } finally {
      setEnterpriseLoading(false);
    }
  };

  const handleRemoveMember = async (member) => {
    setEnterpriseLoading(true);
    setEnterpriseMessage("");

    try {
      await removeWorkspaceMember({
        workspaceId: settings.workspaceId,
        userId: member.userId
      });
      setEnterpriseMessageType("success");
      setEnterpriseMessage("Workspace member removed.");
      await reloadEnterprise();
    } catch (error) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage(error.message || "Workspace member could not be removed.");
    } finally {
      setEnterpriseLoading(false);
    }
  };

  const handleRoleChange = async (member, role) => {
    setEnterpriseLoading(true);
    setEnterpriseMessage("");

    try {
      await updateWorkspaceMemberRole({
        workspaceId: settings.workspaceId,
        userId: member.userId,
        role
      });
      setEnterpriseMessageType("success");
      setEnterpriseMessage("Workspace role updated.");
      await reloadEnterprise();
    } catch (error) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage(error.message || "Workspace role could not be updated.");
    } finally {
      setEnterpriseLoading(false);
    }
  };

  const handlePolicyChange = async (policy, nextType) => {
    setSavingPolicyKey(policy.botScope);
    setEnterpriseMessage("");

    try {
      const savedPolicy = await saveGovernancePolicy({
        workspaceId: settings.workspaceId,
        botScope: policy.botScope,
        policyType: nextType,
        notes: policy.notes
      });
      setEnterprise((current) => ({
        ...current,
        policies: (current?.policies || []).map((item) =>
          item.botScope === savedPolicy.botScope ? savedPolicy : item
        )
      }));
      setEnterpriseMessageType("success");
      setEnterpriseMessage("Governance policy updated.");
    } catch (error) {
      setEnterpriseMessageType("error");
      setEnterpriseMessage(error.message || "Governance policy could not be updated.");
    } finally {
      setSavingPolicyKey("");
    }
  };

  const handleNotificationPreferenceChange = async (preferenceKey, enabled) => {
    if (!settings?.workspaceId) {
      setNotificationMessageType("error");
      setNotificationMessage("A workspace is required before updating notifications.");
      return;
    }

    const nextPreferences = {
      ...notificationPreferences,
      [preferenceKey]: enabled
    };

    setSavingNotifications(preferenceKey);
    setNotificationMessage("");
    setEnterprise((current) => ({
      ...(current || createLocalEnterpriseSettings()),
      notificationPreferences: nextPreferences
    }));

    try {
      const savedPreferences = await saveNotificationPreferences({
        workspaceId: settings.workspaceId,
        preferences: nextPreferences
      });
      setEnterprise((current) => ({
        ...(current || createLocalEnterpriseSettings()),
        notificationPreferences: savedPreferences
      }));
      setNotificationMessageType("success");
      setNotificationMessage("Notification preferences updated.");
    } catch (error) {
      setEnterprise((current) => ({
        ...(current || createLocalEnterpriseSettings()),
        notificationPreferences
      }));
      setNotificationMessageType("error");
      setNotificationMessage(error.message || "Notification preferences could not be saved.");
    } finally {
      setSavingNotifications("");
    }
  };

  const apiKey = settings?.apiKey || {};
  const apiKeyValue = apiKey.key || "";
  const plaintextApiKey = oneTimeApiKey || apiKeyValue;
  const hasStoredApiKey = Boolean(apiKey.id || apiKey.keyPrefix || plaintextApiKey);
  const canRevealApiKey = Boolean(plaintextApiKey);
  const isShowingPlaintextKey = Boolean(revealedApiKey && plaintextApiKey);
  const visibleApiKey = isShowingPlaintextKey ? plaintextApiKey : apiKey.maskedKey || maskApiKey(apiKeyValue);
  const copyableApiKey = isShowingPlaintextKey ? plaintextApiKey : "";
  const apiKeyPrimaryActionLabel = hasStoredApiKey ? "Rotate key" : "Generate key";
  const appUrl = getTrackerInstallUrl();
  const workspaceId = settings?.workspaceId || state.auth.workspaceId || "workspace_id";
  const installPlaintextApiKey = isShowingPlaintextKey ? plaintextApiKey : "";
  const installApiKey = installPlaintextApiKey || "ktrl_live_your_key";
  const installSnippet = getInstallSnippet(installMethod, {
    appUrl,
    workspaceId,
    apiKey: installApiKey
  });
  const canCopyInstallSnippet = Boolean(installPlaintextApiKey);
  const verifiedDomainCount = (settings?.domains || []).filter(
    (item) => String(item.status || "").toLowerCase() === "verified"
  ).length;
  const derivedInstallHealth = {
    status: !hasStoredApiKey ? "not_installed" : installHealth?.status || "pending",
    sdkInstalled: Boolean(installHealth?.sdkInstalled),
    lastEventAt: installHealth?.lastEventAt || null,
    eventsToday: Number(installHealth?.eventsToday || 0),
    activeDomains: Math.max(Number(installHealth?.activeDomains || 0), verifiedDomainCount),
    trackerHealth:
      !hasStoredApiKey
        ? "Generate an API key to start"
        : installHealth?.trackerHealth || "Waiting for first event"
  };
  const installStatusLabel = getInstallStatusLabel(derivedInstallHealth.status);
  const installSteps = [
    {
      id: "key",
      title: "Generate API key",
      detail: "Create the one-time tracker credential for this workspace."
    },
    {
      id: "install",
      title: "Install SDK",
      detail: "Add the snippet to your site, app, CMS, or storefront."
    },
    {
      id: "verify",
      title: "Receive first event",
      detail: "Open your site once and KtrlAI will mark the tracker active."
    }
  ];
  const apiKeyHelpText = !hasStoredApiKey
    ? "Generate an API key to enable live tracker ingestion for this workspace."
    : isShowingPlaintextKey
      ? "Copy this key now. For security, you won't be able to view it again."
      : "Rotate an API key to reveal a full live tracker credential. After refresh, only the masked key is shown.";

  return (
    <AppShell
      title="Configuration"
      eyebrow="Control Plane"
      subtitle="Install the tracker, manage API keys, domains, team access, billing, security, and audit logs."
    >
      {settingsError ? (
        <div className="emptyState">
          <strong>Settings could not be loaded</strong>
          <p>{settingsError}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadSettings}>
              Retry settings
            </button>
          </div>
        </div>
      ) : !settings ? (
        <div className="loadingState">Loading settings...</div>
      ) : (
        <div className="settingsGrid">
          <section className="settingsConfigRail" aria-label="Control plane configuration sections">
            {[
              ["Workspace", "#account", "Identity and plan context"],
              ["Installation", "#install", "SDK and event collection"],
              ["API Keys", "#api-key", "Tracker credentials"],
              ["Domains", "#domains", "DNS verification"],
              ["Governance", "#governance", "Crawler policies"],
              ["Notifications", "#notifications", "Workspace alerts"],
              ["Team Access", "#team", "Roles and invitations"],
              ["Billing", "#billing", "Plan and subscription"],
              ["Security Posture", "#security", "Enterprise controls"],
              ["Audit Logs", "#audit", "Workspace changes"]
            ].map(([label, href, detail]) => (
              <a href={href} key={label}>
                <strong>{label}</strong>
                <span>{detail}</span>
              </a>
            ))}
          </section>
          {!canManageOperations && (
            <section className="panel largePanel roleAccessNotice">
              <div>
                <span className="eyebrow">Workspace role</span>
                <h2>{currentWorkspaceRole}</h2>
                <p>
                  Your role is read-focused. Billing, API keys, domain verification, and security settings are limited
                  to workspace owners and admins.
                </p>
              </div>
              <StatusBadge status={currentWorkspaceRole} />
            </section>
          )}
          {canViewBilling && (
          <section className="panel largePanel billingSettingsPanel" id="billing">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Billing</span>
                <h2>Plan and subscription</h2>
              </div>
              <StatusBadge status={formatSubscriptionStatus(subscriptionStatus)} />
            </div>
            {showBillingWarning && (
              <div className="billingWarningBanner" role="status">
                <strong>Billing attention required</strong>
                <p>
                  Your subscription is {formatSubscriptionStatus(subscriptionStatus)}. Update billing to keep paid plan
                  limits and automated access controls active.
                </p>
              </div>
            )}
            <div className="billingPlanSummary">
              <article>
                <span>Current plan</span>
                <strong>{currentPlan}</strong>
              </article>
              <article>
                <span>Subscription status</span>
                <strong>{formatSubscriptionStatus(subscriptionStatus)}</strong>
              </article>
              <article>
                <span>Renewal date</span>
                <strong>{formatRenewalDate(billing.currentPeriodEnd)}</strong>
              </article>
            </div>
            <div className="billingMiniPlans">
              {billingPlans.map((plan) => {
                const isCurrentPlan = normalizedCurrentPlan === plan.key;
                const managesDowngradeInPortal = plan.key === "free" && hasBillingPortal && !isCurrentPlan;
                const isPlanLoading = billingLoadingPlan === plan.key || (managesDowngradeInPortal && openingBillingPortal);

                return (
                  <article className={isCurrentPlan ? "billingMiniPlan current" : "billingMiniPlan"} key={plan.key}>
                    <div className="billingMiniTop">
                      <div>
                        <strong>{plan.name}</strong>
                        <span>
                          {plan.price}
                          {plan.cadence}
                        </span>
                      </div>
                      {isCurrentPlan ? <em>Current</em> : null}
                    </div>
                    <p>{plan.description}</p>
                    <button
                      type="button"
                      className={plan.highlighted ? "primaryButton smallButton" : "secondaryButton smallButton"}
                      onClick={() => (managesDowngradeInPortal ? handleManageBilling() : handlePlanSelect(plan.key))}
                      disabled={isCurrentPlan || isPlanLoading}
                    >
                      {isPlanLoading
                        ? "Preparing..."
                        : isCurrentPlan
                          ? "Current plan"
                          : managesDowngradeInPortal
                            ? "Manage downgrade"
                            : plan.key === "free"
                              ? "Select Free"
                              : `Choose ${plan.name}`}
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="billingActionRow">
              {hasBillingPortal ? (
                <button
                  type="button"
                  className="secondaryButton smallButton"
                  onClick={handleManageBilling}
                  disabled={openingBillingPortal}
                >
                  {openingBillingPortal ? "Opening..." : "Manage billing"}
                </button>
              ) : null}
              {billingMessage && (
                <p className={`domainVerificationMessage ${billingMessageType === "error" ? "error" : ""}`} role="status">
                  {billingMessage}
                </p>
              )}
            </div>
          </section>
          )}

          {canManageOperations && (
          <section className="panel largePanel installWizardPanel" id="install">
            <div className="installHeroHeader">
              <div>
                <span className="eyebrow">Installation</span>
                <h2>Install KtrlAI tracker</h2>
                <p>Connect your website to start sending live AI access events into this workspace.</p>
              </div>
              <StatusBadge status={installHealthLoading ? "Checking" : installStatusLabel} />
            </div>
            <p className="installStatusSummary">{derivedInstallHealth.trackerHealth}</p>
            <div className="installHealthGrid">
              <article>
                <span>SDK installed</span>
                <strong>{derivedInstallHealth.sdkInstalled ? "Detected" : "Not detected"}</strong>
              </article>
              <article>
                <span>Last event received</span>
                <strong>{formatDateTime(derivedInstallHealth.lastEventAt)}</strong>
              </article>
              <article>
                <span>Events today</span>
                <strong>{derivedInstallHealth.eventsToday}</strong>
              </article>
            </div>
            {installHealthError && (
              <p className="domainVerificationMessage error" role="status">
                {installHealthError}
              </p>
            )}
            <div className="installSetupGrid">
              <article className="installChecklistCard">
                <div>
                  <span className="eyebrow">Setup checklist</span>
                  <h3>Go live in three steps</h3>
                </div>
                <div className="installSteps">
                  {installSteps.map((step, index) => {
                    const stepState = getInstallStepState({
                      step: step.id,
                      hasKey: hasStoredApiKey,
                      hasSnippetKey: canCopyInstallSnippet,
                      installStatus: derivedInstallHealth.status
                    });

                    return (
                      <article className={`installStep ${stepState}`} key={step.id}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.detail}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </article>
              <article className="installSnippetCard">
                <div className="installMethodHeader">
                  <div>
                    <span className="eyebrow">Installation method</span>
                    <h3>Choose your stack</h3>
                  </div>
                </div>
                <div className="installMethodTabs" role="tablist" aria-label="Installation method">
                  {installMethods.map((method) => (
                    <button
                      type="button"
                      className={installMethod === method.id ? "active" : ""}
                      key={method.id}
                      onClick={() => setInstallMethod(method.id)}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
                <div className="installSnippetHeader">
                  <div>
                    <strong>{installSnippet.title}</strong>
                    <p>{installSnippet.detail}</p>
                  </div>
                  <button
                    type="button"
                    className="secondaryButton smallButton"
                    onClick={() => copyValue(installSnippet.code, `install-${installMethod}`)}
                    disabled={!canCopyInstallSnippet}
                  >
                    {copiedItem === `install-${installMethod}`
                      ? "Copied"
                      : canCopyInstallSnippet
                        ? "Copy snippet"
                        : hasStoredApiKey
                          ? "Rotate key first"
                          : "Generate key first"}
                  </button>
                </div>
                <pre className="installCodeBlock" aria-label={`${installMethod} installation snippet`}>
                  <code>{installSnippet.code}</code>
                </pre>
                {!canCopyInstallSnippet && (
                  <p className="securityWarning">
                    Full API keys are only shown immediately after generation or rotation. Rotate the key when you are ready to copy a live install snippet.
                  </p>
                )}
                <div className="localTestNote">
                  <strong>Testing locally?</strong>
                  <p>For best results, test from a local server or hosted page. Create your HTML file, run <code>npx serve .</code>, then open the localhost URL.</p>
                </div>
              </article>
            </div>
            <div className="developerDocs">
              <article>
                <span className="eyebrow">SDK</span>
                <h3>Browser API</h3>
                <pre className="installCodeBlock compactCode">
                  <code>{`window.KtrlAI.track("ai_policy_viewed", {
  pageType: "article",
  accessTier: "summary"
});

window.KtrlAI.identify("user_123", {
  plan: "pro"
});

window.KtrlAI.page();`}</code>
                </pre>
              </article>
              <article>
                <span className="eyebrow">Troubleshooting</span>
                <h3>Verification checklist</h3>
                <ul className="developerChecklist">
                  <li>Confirm the script is present once in the page head.</li>
                  <li>Open your live site after installing the snippet.</li>
                  <li>Use a local server instead of opening test files directly from disk.</li>
                  <li>Rotate the API key if the visible snippet is using a placeholder.</li>
                </ul>
              </article>
            </div>
          </section>
          )}

          {canManageOperations && (
          <section className="panel" id="api-key">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">API</span>
                <h2>API key management</h2>
              </div>
            </div>
            <div className="apiKeyStack">
              {!hasStoredApiKey ? (
                <div className="apiKeyEmptyState">
                  <div>
                    <strong>Generate your first API key</strong>
                    <p>Create a live tracker credential for this workspace. The full key is shown once after generation.</p>
                  </div>
                  <button type="button" className="primaryButton smallButton" onClick={rotateApiKey} disabled={rotatingKey}>
                    {rotatingKey ? "Generating..." : "Generate key"}
                  </button>
                </div>
              ) : (
                <div className={isShowingPlaintextKey ? "apiKey apiKeyPlaintext" : "apiKey"}>
                  <div className="apiKeyDisplay">
                    <span>{isShowingPlaintextKey ? "New API key" : "API key"}</span>
                    <code>{visibleApiKey}</code>
                  </div>
                  <div className="buttonCluster">
                    <button
                      type="button"
                      className="secondaryButton smallButton"
                      onClick={() => copyValue(copyableApiKey, "apiKey")}
                      disabled={!copyableApiKey}
                    >
                      {copiedItem === "apiKey" ? "Copied" : "Copy key"}
                    </button>
                    <button
                      type="button"
                      className="secondaryButton smallButton"
                      onClick={() => setRevealedApiKey((value) => !value)}
                      disabled={!canRevealApiKey}
                    >
                      {revealedApiKey ? "Hide" : "Reveal"}
                    </button>
                    <button type="button" className="secondaryButton smallButton" onClick={rotateApiKey} disabled={rotatingKey}>
                      {rotatingKey ? "Rotating..." : apiKeyPrimaryActionLabel}
                    </button>
                  </div>
                </div>
              )}
              <p className="securityWarning">
                {apiKeyHelpText}
              </p>
              <div className="keyMeta">
                <span>Last used <strong>{formatDate(apiKey.lastUsedAt)}</strong></span>
                <span>Rotated <strong>{formatDate(apiKey.rotatedAt)}</strong></span>
              </div>
              {apiKeyMessage && (
                <p className={`domainVerificationMessage ${apiKeyMessageType === "error" ? "error" : ""}`} role="status">
                  {apiKeyMessage}
                </p>
              )}
            </div>
          </section>
          )}

          {canManageOperations && (
          <section className="panel largePanel" id="domains">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Domains</span>
                <h2>Domain verification</h2>
              </div>
            </div>
            <div className="domainForm">
              <input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="docs.company.com"
                aria-label="Domain name"
              />
              <button type="button" className="primaryButton smallButton" onClick={addDomain}>
                Add
              </button>
            </div>
            {domainMessage && (
              <p className="domainVerificationMessage error" role="status">
                {domainMessage}
              </p>
            )}
            {settings.domains.length === 0 ? (
              <div className="emptyState compact">
                <strong>No domains connected</strong>
                <p>Add a domain to begin collecting AI access and visibility data.</p>
              </div>
            ) : (
              <div className="domainVerificationList">
                {settings.domains.map((item) => {
                  const dnsRecord = buildDnsRecord(item.hostname, item.verificationToken);
                  const dnsRecordText = `Type: ${dnsRecord.type}\nHost: ${dnsRecord.host}\nValue: ${dnsRecord.value}`;

                  return (
                    <article className="domainVerificationCard" key={item.id}>
                      <div className="domainVerificationHeader">
                        <div>
                          <strong>{item.hostname}</strong>
                          <span>Last checked {formatDate(item.lastCheckedAt)}</span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="dnsRecordGrid">
                        <span>Type</span>
                        <code>{dnsRecord.type}</code>
                        <span>Host</span>
                        <code>{dnsRecord.host}</code>
                        <span>Value</span>
                        <code>{dnsRecord.value}</code>
                      </div>
                      <div className="domainActions">
                        <button
                          type="button"
                          className="secondaryButton smallButton"
                          onClick={() => copyValue(dnsRecordText, `dns-${item.id}`)}
                        >
                          {copiedItem === `dns-${item.id}` ? "Copied" : "Copy DNS record"}
                        </button>
                        <button
                          type="button"
                          className="secondaryButton smallButton"
                          onClick={() => checkDomain(item.id)}
                          disabled={checkingDomainId === item.id}
                        >
                          {checkingDomainId === item.id ? "Checking..." : "Check verification"}
                        </button>
                      </div>
                      {verificationMessages[item.id] && (
                        <p
                          className={
                            item.status === "Failed" || verificationMessages[item.id].includes("TXT record not found")
                              ? "domainVerificationMessage error"
                              : "domainVerificationMessage"
                          }
                          role="status"
                        >
                          {verificationMessages[item.id]}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {canViewSecurity && (
            <section className="panel largePanel enterprisePanel" id="team">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Team Management</span>
                  <h2>Workspace collaboration</h2>
                </div>
                <StatusBadge status={enterpriseLoading ? "Loading" : currentWorkspaceRole} />
              </div>
              <p className="enterpriseCopy">
                Owners manage membership, admins manage operational controls, analysts view analytics, and viewers have read-only access.
              </p>
              {canManageTeam && (
                <div className="inviteMemberCard">
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="teammate@company.com"
                    aria-label="Invite email"
                  />
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} aria-label="Invite role">
                    <option value="admin">Admin</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="button" className="primaryButton smallButton" onClick={handleInviteMember} disabled={enterpriseLoading}>
                    Send invite
                  </button>
                </div>
              )}
              <div className="teamList">
                {(enterprise?.members || []).map((member) => (
                  <article key={member.id || member.userId}>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </div>
                    <StatusBadge status={member.role} />
                    {canManageTeam && member.role !== "owner" ? (
                      <div className="teamActions">
                        <select value={member.role} onChange={(event) => handleRoleChange(member, event.target.value)}>
                          <option value="admin">Admin</option>
                          <option value="analyst">Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button type="button" className="secondaryButton smallButton" onClick={() => handleRemoveMember(member)}>
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              {(enterprise?.invitations || []).length > 0 && (
                <div className="auditMiniList">
                  <h3>Pending invitations</h3>
                  {enterprise.invitations.map((invite) => (
                    <div key={invite.id}>
                      <span>{invite.email}</span>
                      <strong>{invite.role}</strong>
                      <em>{invite.status}</em>
                    </div>
                  ))}
                </div>
              )}
              {enterpriseMessage && (
                <p className={`domainVerificationMessage ${enterpriseMessageType === "error" ? "error" : ""}`} role="status">
                  {enterpriseMessage}
                </p>
              )}
            </section>
          )}

          {canViewSecurity && (
            <section className="panel largePanel enterprisePanel" id="governance">
              <div className="panelHeader">
                <div>
                    <span className="eyebrow">Governance</span>
                    <h2>Crawler policy engine</h2>
                </div>
              </div>
              <div className="policyGrid">
                {(enterprise?.policies || []).map((policy) => (
                  <article key={policy.id || policy.botScope}>
                    <div>
                      <strong>{policy.botScope}</strong>
                      <p>{policy.notes}</p>
                    </div>
                    <select
                      value={policy.policyType}
                      onChange={(event) => handlePolicyChange(policy, event.target.value)}
                      disabled={!canManageOperations || savingPolicyKey === policy.botScope}
                    >
                      <option value="allow">Allow</option>
                      <option value="monitor">Monitor</option>
                      <option value="restrict">Restrict</option>
                      <option value="block">Block</option>
                    </select>
                  </article>
                ))}
              </div>
              <p className="securityWarning">
                Policies are governance signals for visibility and workflow. Network-level blocking is not enabled yet.
              </p>
            </section>
          )}

          {canViewSecurity && (
            <section className="panel largePanel enterprisePanel" id="audit">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Audit Logs</span>
                  <h2>Workspace security activity</h2>
                </div>
                <button type="button" className="secondaryButton smallButton" onClick={reloadEnterprise} disabled={enterpriseLoading}>
                  Refresh
                </button>
              </div>
              {(enterprise?.auditLogs || []).length === 0 ? (
                <div className="emptyState compact">
                  <strong>No audit activity yet</strong>
                  <p>Security, billing, team, policy, domain, and API key changes will appear here.</p>
                </div>
              ) : (
                <div className="tableWrap compactTableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Actor</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterprise.auditLogs.map((event) => (
                        <tr key={event.id}>
                          <td>{event.eventSummary}</td>
                          <td>{event.actor}</td>
                          <td>{formatDateTime(event.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {canViewSecurity && (
            <section className="panel enterprisePanel" id="security">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Security</span>
                  <h2>Enterprise posture</h2>
                </div>
              </div>
              <div className="securityPostureList">
                <article className="securityPostureItem">
                  <span className="securityPostureIcon" aria-hidden="true" />
                  <div className="securityPostureContent">
                    <div className="securityPostureTitleRow">
                      <strong>Server-side role checks</strong>
                      <span className="securityPostureStatus">Enabled</span>
                    </div>
                    <p>Workspace mutations require owner or admin authorization.</p>
                  </div>
                </article>
                <article className="securityPostureItem">
                  <span className="securityPostureIcon" aria-hidden="true" />
                  <div className="securityPostureContent">
                    <div className="securityPostureTitleRow">
                      <strong>Hashed API keys</strong>
                      <span className="securityPostureStatus">Enabled</span>
                    </div>
                    <p>Full API keys are shown once and stored as server-side hashes.</p>
                  </div>
                </article>
                <article className="securityPostureItem">
                  <span className="securityPostureIcon" aria-hidden="true" />
                  <div className="securityPostureContent">
                    <div className="securityPostureTitleRow">
                      <strong>Abuse controls</strong>
                      <span className="securityPostureStatus">Enabled</span>
                    </div>
                    <p>Tracker, billing, admin, API key, and domain endpoints include rate limits.</p>
                  </div>
                </article>
              </div>
            </section>
          )}

          {canViewSecurity && (
            <section className="panel enterprisePanel" id="notifications">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">Notifications</span>
                  <h2>Email preferences</h2>
                </div>
                <StatusBadge status={notificationPreferences.emailNotifications ? "Enabled" : "Paused"} />
              </div>
              <p className="enterpriseCopy">
                Control customer-facing workspace emails for installation, billing, crawler alerts, and team invites.
              </p>
              <div className="toggleList">
                {[
                  {
                    key: "emailNotifications",
                    title: "Email notifications",
                    detail: "Master switch for workspace email delivery."
                  },
                  {
                    key: "installVerified",
                    title: "Install verified alerts",
                    detail: "Send an email when the tracker receives its first live event."
                  },
                  {
                    key: "billingAlerts",
                    title: "Billing alerts",
                    detail: "Notify owners and admins about active billing and failed payments."
                  },
                  {
                    key: "suspiciousCrawlerAlerts",
                    title: "Suspicious crawler alerts",
                    detail: "Rate-limited alerts when high-confidence suspicious crawler traffic is detected."
                  },
                  {
                    key: "teamInviteEmails",
                    title: "Team invitation emails",
                    detail: "Email invited teammates when owners create workspace invitations."
                  }
                ].map((item) => (
                  <label className="toggleRow" key={item.key}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(notificationPreferences[item.key])}
                      disabled={!canManageOperations || Boolean(savingNotifications)}
                      onChange={(event) => handleNotificationPreferenceChange(item.key, event.target.checked)}
                      aria-label={item.title}
                    />
                  </label>
                ))}
              </div>
              {!canManageOperations && (
                <p className="securityWarning">Only workspace owners and admins can update notification preferences.</p>
              )}
              {notificationMessage && (
                <p className={`domainVerificationMessage ${notificationMessageType === "error" ? "error" : ""}`} role="status">
                  {notificationMessage}
                </p>
              )}
            </section>
          )}

          <section className="panel" id="account">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Account</span>
                <h2>Account settings</h2>
              </div>
            </div>
            <div className="accountList">
              <span>Name <strong>{settings.account.name}</strong></span>
              <span>Email <strong>{settings.account.email}</strong></span>
              <span>Plan <strong>{settings.account.plan}</strong></span>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
