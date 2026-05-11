import { useEffect, useState } from "react";
import { RouteLink } from "../navigation.jsx";

const hints = {
  "/dashboard": {
    title: "Dashboard overview",
    body: "This is your command center for live AI access, install health, crawler activity, and revenue signals.",
    to: "/settings#install",
    cta: "Finish setup"
  },
  "/settings": {
    title: "Install guidance",
    body: "Generate or rotate an API key, copy the tracker snippet, then test from a local server or hosted page.",
    to: "/docs/install",
    cta: "Open docs"
  },
  "/analytics": {
    title: "Analytics explained",
    body: "Analytics switch from sample preview to live data as soon as your workspace receives tracker events.",
    to: "/docs/analytics",
    cta: "Learn detection"
  },
  "/activity": {
    title: "AI detection feed",
    body: "Each event is enriched with bot identity, category, confidence, and suspicious traffic signals.",
    to: "/docs/analytics",
    cta: "How it works"
  }
};

function getHintState(path) {
  try {
    return JSON.parse(window.localStorage.getItem(`ktrlai_hint_${path}`) || "{}");
  } catch {
    return {};
  }
}

export default function ProductHint({ path }) {
  const hint = hints[path];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hint) {
      setVisible(false);
      return;
    }

    const state = getHintState(path);
    const visits = Number(state.visits || 0) + 1;
    const nextState = { ...state, visits };
    window.localStorage.setItem(`ktrlai_hint_${path}`, JSON.stringify(nextState));
    setVisible(!state.dismissed && visits <= 3);
  }, [hint, path]);

  if (!hint || !visible) {
    return null;
  }

  const dismiss = () => {
    const state = getHintState(path);
    window.localStorage.setItem(`ktrlai_hint_${path}`, JSON.stringify({ ...state, dismissed: true }));
    setVisible(false);
  };

  return (
    <aside className="productHint" aria-label="Product guidance">
      <div>
        <span className="eyebrow">Guide</span>
        <strong>{hint.title}</strong>
        <p>{hint.body}</p>
      </div>
      <div className="productHintActions">
        <RouteLink to={hint.to} className="secondaryButton smallButton">
          {hint.cta}
        </RouteLink>
        <button type="button" className="textButton" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </aside>
  );
}
