import { useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function ControlCenter() {
  const { state, actions } = useApp();
  const [bot, setBot] = useState("ChatGPT-User");
  const [access, setAccess] = useState("Allow summaries only");

  useEffect(() => {
    if (!state.controls && !state.loading.controls) {
      actions.loadControls();
    }
  }, [actions, state.controls, state.loading.controls]);

  const controls = state.controls;

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
        </div>
      )}
    </AppShell>
  );
}
