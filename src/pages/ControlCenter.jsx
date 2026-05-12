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

  const addRule = async () => {
    await actions.addControlRule({ bot, access });
    setBot("ChatGPT-User");
    setAccess("Allow summaries only");
  };

  return (
    <AppShell title="Control Center" eyebrow="Policy engine">
      {!controls ? (
        <div className="loadingState">Loading control policies...</div>
      ) : (
        <div className="controlLayout">
          <section className="panel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">Toggle rules</span>
                <h2>Default AI access policies</h2>
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
                <span className="eyebrow">Rule builder</span>
                <h2>IF bot = X {"->"} Allow Y access</h2>
              </div>
            </div>
            <div className="ruleBuilder">
              <label>
                IF bot =
                <select value={bot} onChange={(event) => setBot(event.target.value)}>
                  <option>ChatGPT-User</option>
                  <option>PerplexityBot</option>
                  <option>ClaudeBot</option>
                  <option>Google-Extended</option>
                  <option>Unknown LLM Crawler</option>
                </select>
              </label>
              <label>
                Allow
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
                <span className="eyebrow">AI policy engine</span>
                <h2>Governance visibility</h2>
              </div>
              <StatusBadge status="Policy preview" />
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
                    <option value="block">Block</option>
                  </select>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
