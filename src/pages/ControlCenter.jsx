import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function ControlCenter() {
  const { state, actions } = useApp();
  const [bot, setBot] = useState("ChatGPT-User");
  const [access, setAccess] = useState("Allow summaries only");
  const [policyOverrides, setPolicyOverrides] = useState({});

  useEffect(() => {
    if (!state.controls && !state.loading.controls) {
      actions.loadControls();
    }
  }, [actions, state.controls, state.loading.controls]);

  const controls = state.controls;
  const policyRows = (controls?.governancePolicies || []).map((policy) => ({
    ...policy,
    policyType: policyOverrides[policy.botScope] || policy.policyType
  }));
  const activePolicyCount = controls?.rules?.filter((rule) => rule.enabled).length || 0;
  const monitoredCount = policyRows.filter((policy) => policy.policyType === "monitor").length;
  const restrictedCount = policyRows.filter((policy) => ["restrict", "block"].includes(policy.policyType)).length;

  const addRule = async () => {
    await actions.addControlRule({ bot, access });
    setBot("ChatGPT-User");
    setAccess("Allow summaries only");
  };

  return (
    <AppShell title="Governance" eyebrow="Control Plane">
      {!controls ? (
        <div className="loadingState">Loading control policies...</div>
      ) : (
        <>
        <section className="governanceStatusGrid" aria-label="Governance readiness">
          <article>
            <span>Active policies</span>
            <strong>{activePolicyCount}</strong>
            <em>Default workspace controls enabled</em>
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
            <span>Licensing state</span>
            <strong>Charge-ready</strong>
            <em>Commercial access rules prepared</em>
          </article>
        </section>
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
                    onChange={(event) => actions.updateControlRule(rule.id, event.target.checked)}
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
              <button type="button" className="primaryButton" onClick={addRule}>
                Add rule
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
              Define crawler intent for analytics and governance workflows. Network-level blocking is not enabled yet.
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
                    onChange={(event) =>
                      setPolicyOverrides((current) => ({
                        ...current,
                        [policy.botScope]: event.target.value
                      }))
                    }
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
