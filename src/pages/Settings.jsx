import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { billingPlans, normalizePlan } from "../billing/stripeConfig.js";
import { openBillingPortal, startBillingCheckout } from "../billing/billingApi.js";
import { useApp } from "../context/AppContext.jsx";
import {
  buildDnsRecord,
  maskApiKey,
  mergeDomainVerificationResult,
  rotateApiKeyWithApi,
  verifyDomainWithApi
} from "../settings/securityUtils.js";

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

export default function Settings() {
  const { state, actions } = useApp();
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

  useEffect(() => {
    if (!state.settings && !state.loading.settings) {
      actions.loadSettings();
    }
  }, [actions, state.loading.settings, state.settings]);

  const settings = state.settings;
  const settingsError = state.errors.settings;
  const billing = settings?.billing || {};
  const currentPlan = billing.plan || settings?.account?.plan || "Free";
  const normalizedCurrentPlan = normalizePlan(currentPlan);
  const subscriptionStatus = billing.subscriptionStatus || (normalizedCurrentPlan === "free" ? "free" : "active");
  const subscriptionStatusKey = String(subscriptionStatus || "free").toLowerCase();
  const hasBillingPortal = Boolean(billing.hasStripeCustomer);
  const showBillingWarning = billingWarningStatuses.has(subscriptionStatusKey);

  const copyValue = async (value, itemKey) => {
    if (value && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopiedItem(itemKey);
      window.setTimeout(() => setCopiedItem(""), 1500);
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

  const apiKey = settings?.apiKey || {};
  const apiKeyValue = apiKey.key || "";
  const plaintextApiKey = oneTimeApiKey || apiKeyValue;
  const hasStoredApiKey = Boolean(apiKey.id || apiKey.keyPrefix || plaintextApiKey);
  const canRevealApiKey = Boolean(plaintextApiKey);
  const isShowingPlaintextKey = Boolean(revealedApiKey && plaintextApiKey);
  const visibleApiKey = isShowingPlaintextKey ? plaintextApiKey : apiKey.maskedKey || maskApiKey(apiKeyValue);
  const copyableApiKey = isShowingPlaintextKey ? plaintextApiKey : "";
  const apiKeyPrimaryActionLabel = hasStoredApiKey ? "Rotate key" : "Generate key";
  const apiKeyHelpText = !hasStoredApiKey
    ? "Generate an API key to enable live tracker ingestion for this workspace."
    : isShowingPlaintextKey
      ? "Copy this key now. For security, you won't be able to view it again."
      : "Rotate an API key to reveal a full live tracker credential. After refresh, only the masked key is shown.";

  return (
    <AppShell title="Settings" eyebrow="Workspace">
      {settingsError ? (
        <div className="emptyState">
          <strong>Settings could not be loaded</strong>
          <p>{settingsError}</p>
        </div>
      ) : !settings ? (
        <div className="loadingState">Loading settings...</div>
      ) : (
        <div className="settingsGrid">
          <section className="panel largePanel billingSettingsPanel">
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

          <section className="panel largePanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Script installation</span>
                <h2>Install KtrlAI tracker</h2>
              </div>
            </div>
            <div className="scriptBox">
              <code>{settings.script}</code>
              <button
                type="button"
                className="secondaryButton smallButton"
                onClick={() => copyValue(settings.script, "script")}
                disabled={!canRevealApiKey}
              >
                {copiedItem === "script" ? "Copied" : canRevealApiKey ? "Copy" : hasStoredApiKey ? "Rotate key first" : "Generate key first"}
              </button>
            </div>
          </section>

          <section className="panel">
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

          <section className="panel largePanel">
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

          <section className="panel">
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
