import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
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

export default function Settings() {
  const { state, actions } = useApp();
  const [domain, setDomain] = useState("");
  const [copiedItem, setCopiedItem] = useState("");
  const [checkingDomainId, setCheckingDomainId] = useState("");
  const [verificationMessages, setVerificationMessages] = useState({});
  const [domainMessage, setDomainMessage] = useState("");
  const [apiKeyMessage, setApiKeyMessage] = useState("");
  const [revealedApiKey, setRevealedApiKey] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  useEffect(() => {
    if (!state.settings && !state.loading.settings) {
      actions.loadSettings();
    }
  }, [actions, state.loading.settings, state.settings]);

  const settings = state.settings;
  const settingsError = state.errors.settings;

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
    setRotatingKey(true);
    setRevealedApiKey(false);
    setApiKeyMessage("");
    try {
      let result;

      try {
        result = await rotateApiKeyWithApi({ workspaceId: settings.workspaceId || "demo" });
        actions.applyApiKeyRotation(result);
      } catch (error) {
        if (!error.useMockFallback) {
          throw error;
        }
        result = await actions.rotateApiKey();
      }

      setRevealedApiKey(Boolean(result.apiKey?.key));
    } catch (error) {
      setApiKeyMessage(error.message || "API key could not be rotated.");
    } finally {
      setRotatingKey(false);
    }
  };

  const apiKey = settings?.apiKey || {};
  const apiKeyValue = apiKey.key || "";
  const canRevealApiKey = Boolean(apiKeyValue);
  const visibleApiKey = revealedApiKey && canRevealApiKey ? apiKeyValue : apiKey.maskedKey || maskApiKey(apiKeyValue);

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
                {copiedItem === "script" ? "Copied" : canRevealApiKey ? "Copy" : "Rotate key first"}
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
              <div className="apiKey">
                <code>{visibleApiKey}</code>
                <div className="buttonCluster">
                  <button
                    type="button"
                    className="secondaryButton smallButton"
                    onClick={() => copyValue(apiKeyValue, "apiKey")}
                    disabled={!canRevealApiKey}
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
                    {rotatingKey ? "Rotating..." : "Rotate key"}
                  </button>
                </div>
              </div>
              <p className="securityWarning">
                {canRevealApiKey
                  ? "Copy this key now. For security, you won't be able to view it again."
                  : "Rotate an API key to reveal a full live tracker credential. After refresh, only the masked key is shown."}
              </p>
              <div className="keyMeta">
                <span>Last used <strong>{formatDate(apiKey.lastUsedAt)}</strong></span>
                <span>Rotated <strong>{formatDate(apiKey.rotatedAt)}</strong></span>
              </div>
              {apiKeyMessage && (
                <p className="domainVerificationMessage error" role="status">
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
