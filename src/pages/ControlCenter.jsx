import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import {
  AIAccessDecisions,
  GovernanceCoverage
} from "../components/SignatureWidgets.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { accessToPolicyType, normalizeGovernanceBotScope } from "../governance/governanceControls.js";

export default function ControlCenter() {
  const { state, actions } = useApp();
  const [bot, setBot] = useState("ChatGPT-User");
  const [access, setAccess] = useState("Allow summaries only");
  const [savingPolicyKey, setSavingPolicyKey] = useState("");
  const [policyMessage, setPolicyMessage] = useState("");
  const [policyMessageType, setPolicyMessageType] = useState("success");

  useEffect(() => {
    if (!state.controls && !state.loading.controls) {
      actions.loadControls();
    }
  }, [actions, state.controls, state.loading.controls]);

  const controls = state.controls;
  const policyRows = controls?.governancePolicies || [];
  const activePolicyCount = controls?.rules?.filter((rule) => rule.enabled).length || 0;
  const monitoredCount = policyRows.filter((policy) => policy.policyType === "monitor").length;
  const restrictedCount = policyRows.filter((policy) => ["restrict", "block"].includes(policy.policyType)).length;
  const trainingRuleCount = policyRows.filter((policy) => /training|learn|dataset/i.test(`${policy.notes || ""} ${policy.detail || ""}`)).length;
  const chargeReadyCount = policyRows.filter((policy) => /charge|paid|licens/i.test(`${policy.notes || ""} ${policy.detail || ""} ${policy.policyType || ""}`)).length;
  const canManagePolicies = controls?.permissions?.canManageOperations !== false;
  const totalPolicySurface = Math.max(policyRows.length + (controls?.rules?.length || 0), 1);
  const governanceCoverage = controls ? Math.min(96, Math.round(((activePolicyCount + policyRows.length) / totalPolicySurface) * 100)) : 0;

  const savePolicy = async ({ botScope, policyType, notes }) => {
    const normalizedScope = normalizeGovernanceBotScope(botScope);

    setSavingPolicyKey(normalizedScope);
    setPolicyMessage("");

    try {
      await actions.saveGovernancePolicy({
        botScope: normalizedScope,
        policyType,
        notes
      });
      setPolicyMessage("Governance policy saved.");
      setPolicyMessageType("success");
      return true;
    } catch (error) {
      setPolicyMessage(error.message || "Governance policy could not be saved.");
      setPolicyMessageType("error");
      return false;
    } finally {
      setSavingPolicyKey("");
    }
  };

  const handleRuleToggle = (rule, enabled) => {
    if (!rule.botScope) {
      return actions.updateControlRule(rule.id, enabled);
    }

    return savePolicy({
      botScope: rule.botScope,
      policyType: enabled ? rule.enabledPolicyType : rule.disabledPolicyType,
      notes: rule.detail
    });
  };

  const handlePolicyChange = (policy, nextType) =>
    savePolicy({
      botScope: policy.botScope,
      policyType: nextType,
      notes: policy.notes || policy.detail
    });

  const addRule = async () => {
    const saved = await savePolicy({
      botScope: bot,
      policyType: accessToPolicyType(access),
      notes: access
    });

    if (saved) {
      setBot("ChatGPT-User");
      setAccess("Allow summaries only");
    }
  };

  return (
    <AppShell
      title="Access Governance"
      eyebrow="Governance"
      subtitle="Define crawler access rules for monitoring, restriction, citation, training, and charge-ready workflows."
    >
      {state.errors.controls ? (
        <div className="emptyState">
          <strong>Governance policies could not be loaded</strong>
          <p>{state.errors.controls}</p>
          <div className="emptyStateActions">
            <button type="button" className="secondaryButton smallButton" onClick={actions.loadControls}>
              Retry
            </button>
          </div>
        </div>
      ) : !controls ? (
        <div className="loadingState">Loading control policies...</div>
      ) : (
        <>
        <section className="commandHero governanceCommandHero" aria-label="AI access governance command summary">
          <div className="commandHeroCopy">
            <span className="eyebrow">AI access governance</span>
            <h2>Policy coverage for operators, assets, training, and charge-ready workflows.</h2>
            <p>Define how crawler activity is monitored, restricted, reviewed, and preserved as tracker metadata.</p>
          </div>
          <div className="commandHeroMetrics">
            <article>
              <span>Active policies</span>
              <strong>{activePolicyCount}</strong>
              <em>Workspace defaults</em>
            </article>
            <article>
              <span>Protected assets</span>
              <strong>{policyRows.length}</strong>
              <em>Operator-specific states</em>
            </article>
            <article>
              <span>Training rules</span>
              <strong>{trainingRuleCount}</strong>
              <em>Model-learning controls</em>
            </article>
            <article>
              <span>Licensing rules</span>
              <strong>{chargeReadyCount}</strong>
              <em>Commercial workflows</em>
            </article>
          </div>
        </section>
        <section className="signatureWidgetGrid governanceSignatureGrid" aria-label="Governance coverage widgets">
          <GovernanceCoverage
            coverage={governanceCoverage}
            assetsProtected={policyRows.length}
            policiesActive={activePolicyCount}
            trainingRules={trainingRuleCount}
            licensingRules={chargeReadyCount}
          />
          <AIAccessDecisions
            allowed={policyRows.filter((policy) => policy.policyType === "allow").length}
            denied={restrictedCount}
            training={trainingRuleCount}
            licensing={chargeReadyCount}
            review={monitoredCount}
            detail="Operator permissions convert crawler evidence into allow, restrict, training, licensing, and review workflows."
          />
          <article className="signatureWidget">
            <span className="eyebrow">Needs attention</span>
            <h2>{restrictedCount ? "Restricted scopes active" : "Add protected scopes"}</h2>
            <p>Use policy rules to distinguish citation, training, paid access, and suspicious crawler workflows.</p>
          </article>
        </section>
        <section className="governanceStatusGrid" aria-label="Governance readiness">
          <article>
            <span>Total rules</span>
            <strong>{policyRows.length + (controls.rules?.length || 0)}</strong>
            <em>Defaults and crawler-specific access rules</em>
          </article>
          <article>
            <span>Active rules</span>
            <strong>{activePolicyCount}</strong>
            <em>{controls.source === "enterprise" ? "Loaded from workspace policy storage" : "Local development controls enabled"}</em>
          </article>
          <article>
            <span>Monitored crawlers</span>
            <strong>{monitoredCount}</strong>
            <em>Tracked without enforcement</em>
          </article>
          <article>
            <span>Restricted scopes</span>
            <strong>{restrictedCount}</strong>
            <em>Ready for tighter handling</em>
          </article>
          <article>
            <span>Training rules</span>
            <strong>{trainingRuleCount}</strong>
            <em>Model-learning policy signals</em>
          </article>
          <article>
            <span>Charge-ready rules</span>
            <strong>{chargeReadyCount}</strong>
            <em>Commercial access workflows prepared</em>
          </article>
        </section>
        {policyMessage && (
          <p className={`domainVerificationMessage ${policyMessageType === "error" ? "error" : ""}`} role="status">
            {policyMessage}
          </p>
        )}
        <div className="controlLayout">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Policy defaults</span>
                <h2>Workspace crawler posture</h2>
              </div>
            </div>
            <div className="toggleList">
              {controls.rules.map((rule) => (
                <label className="toggleRow" key={rule.id}>
                  <div>
                    <strong>{rule.label}</strong>
                    <span>{rule.detail}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => handleRuleToggle(rule, event.target.checked)}
                    disabled={!canManagePolicies || savingPolicyKey === rule.botScope}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Policy builder</span>
                <h2>IF crawler = X {"->"} apply Y access</h2>
              </div>
            </div>
            <div className="ruleBuilder">
              <label>
                IF crawler =
                <select value={bot} onChange={(event) => setBot(event.target.value)}>
                  <option>ChatGPT-User</option>
                  <option>PerplexityBot</option>
                  <option>ClaudeBot</option>
                  <option>Google-Extended</option>
                  <option>Unknown LLM Crawler</option>
                </select>
              </label>
              <label>
                Action
                <select value={access} onChange={(event) => setAccess(event.target.value)}>
                  <option>Allow full access</option>
                  <option>Allow summaries only</option>
                  <option>Paid access required</option>
                  <option>Training denied</option>
                  <option>Block all access</option>
                </select>
              </label>
              <button
                type="button"
                className="primaryButton"
                onClick={addRule}
                disabled={!canManagePolicies || savingPolicyKey === normalizeGovernanceBotScope(bot)}
              >
                {savingPolicyKey === normalizeGovernanceBotScope(bot) ? "Saving..." : "Add rule"}
              </button>
            </div>
            {controls.customRules.length === 0 ? (
              <div className="emptyState compact">
                <strong>No custom rules yet</strong>
                <p>Create a bot-specific policy when a default rule is not granular enough.</p>
              </div>
            ) : (
              <div className="ruleList">
                {controls.customRules.map((rule) => (
                  <article key={rule.id}>
                    <strong>{rule.bot}</strong>
                    <span>{rule.access}</span>
                    <em>{rule.createdAt}</em>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel largePanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Crawler matrix</span>
                <h2>Operator governance states</h2>
              </div>
              <StatusBadge status="Control-ready" />
            </div>
            <p className="enterpriseCopy">
              Network-level blocking is not enabled yet. Policies currently drive visibility, workflow, and tracker metadata.
            </p>
            <div className="policyGrid">
              {policyRows.map((policy) => (
                <article key={policy.id}>
                  <div>
                    <strong>{policy.botScope}</strong>
                    <p>{policy.detail}</p>
                  </div>
                  <select
                    value={policy.policyType}
                    onChange={(event) => handlePolicyChange(policy, event.target.value)}
                    disabled={!canManagePolicies || savingPolicyKey === policy.botScope}
                  >
                    <option value="allow">Allow</option>
                    <option value="monitor">Monitor</option>
                    <option value="restrict">Restrict</option>
                    <option value="block">Block-ready</option>
                  </select>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Readiness</span>
                <h2>Robots and licensing signals</h2>
              </div>
              <StatusBadge status="Prepared" />
            </div>
            <div className="infraHealthList">
              <div>
                <span>robots.txt readiness</span>
                <strong>Review recommended</strong>
                <em>Use governance evidence before changing public crawler instructions.</em>
              </div>
              <div>
                <span>Suspicious traffic handling</span>
                <strong>Monitor first</strong>
                <em>High-risk crawlers are visible without network-level blocking.</em>
              </div>
              <div>
                <span>Licensing readiness</span>
                <strong>Charge-ready</strong>
                <em>Access rules can support future content licensing workflows.</em>
              </div>
            </div>
          </section>
        </div>
        </>
      )}
    </AppShell>
  );
}
