import StatusBadge from "./StatusBadge.jsx";
import { RouteLink } from "../navigation.jsx";
import { useEffect, useMemo, useState } from "react";

const SETUP_GUIDE_PREFIX = "ktrlai_setup_guide";

function stepStatus(done, current) {
  if (done) return "Complete";
  if (current) return "Next";
  return "Pending";
}

export default function SetupGuide({ settings, dashboard }) {
  const storageKey = useMemo(
    () => `${SETUP_GUIDE_PREFIX}_${settings?.workspaceId || "workspace"}`,
    [settings?.workspaceId]
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const apiKey = settings?.apiKey || {};
  const domains = settings?.domains || [];
  const hasApiKey = Boolean(apiKey.id || apiKey.keyPrefix || apiKey.key);
  const hasDomain = domains.length > 0;
  const hasRealData = Boolean(dashboard?.hasRealData);
  const hasExploredAnalytics = hasRealData;
  const progress = [hasApiKey, hasDomain, hasRealData, hasExploredAnalytics].filter(Boolean).length;
  const isComplete = progress === 4;

  useEffect(() => {
    try {
      setIsDismissed(window.localStorage.getItem(storageKey) === "dismissed");
    } catch {
      setIsDismissed(false);
    }
  }, [storageKey]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "dismissed");
    } catch {
      // Ignore storage failures; hiding the guide in memory is still useful.
    }
    setIsDismissed(true);
  };

  const steps = [
    {
      title: "Generate API key",
      why: "This gives your tracker a secure workspace credential without exposing stored secrets.",
      to: "/settings#api-key",
      done: hasApiKey,
      current: !hasApiKey
    },
    {
      title: "Install tracker",
      why: "The tracker sends page events that KtrlAI turns into AI crawler intelligence.",
      to: "/settings#install",
      done: hasDomain && hasApiKey,
      current: hasApiKey && !hasRealData
    },
    {
      title: "Receive first event",
      why: "Your first event verifies installation and activates live operations telemetry.",
      to: "/activity",
      done: hasRealData,
      current: hasApiKey && hasDomain && !hasRealData
    },
    {
      title: "Explore analytics",
      why: "See AI systems, suspicious traffic, and top pages once live activity appears.",
      to: "/analytics",
      done: hasExploredAnalytics,
      current: hasRealData
    }
  ];

  if (isDismissed) {
    return null;
  }

  return (
    <section className={isComplete ? "setupGuide complete panel" : "setupGuide panel"} aria-label="Workspace onboarding">
      <div className="setupGuideHeader">
        <div>
          <span className="eyebrow">{isComplete ? "Tracker connected" : "Launch checklist"}</span>
          <h2>{isComplete ? "Tracker connected successfully" : "Set up KtrlAI in minutes"}</h2>
          <p>
            {isComplete
              ? "Your first live event is in. Explore analytics to understand who is accessing your content."
              : "Generate a secure key, install the tracker, and KtrlAI will start detecting AI crawler activity for this workspace."}
          </p>
        </div>
        <div className="setupGuideControls">
          <div className="setupProgress" aria-label={`${progress} of 4 setup steps complete`}>
            <strong>{progress}/4</strong>
            <span>complete</span>
          </div>
          <button type="button" className="textButton setupDismissButton" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      </div>
      <div className="setupProgressBar" aria-hidden="true">
        <span style={{ width: `${(progress / 4) * 100}%` }} />
      </div>
      <div className="setupStepList">
        {steps.map((step, index) => (
          <article className={step.done ? "done" : step.current ? "current" : ""} key={step.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.why}</p>
            </div>
            <StatusBadge status={stepStatus(step.done, step.current)} />
            <RouteLink to={step.to} className={step.current ? "primaryButton smallButton" : "secondaryButton smallButton"}>
              {step.done ? "View" : "Start"}
            </RouteLink>
          </article>
        ))}
      </div>
    </section>
  );
}
