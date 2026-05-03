import { RouteLink } from "../navigation.jsx";

export default function Logo({ linked = true, compact = false }) {
  const mark = (
    <span className="logo" aria-label="KtrlAI">
      <span className="logoIcon" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="logoWord">
          <strong>Ktrl</strong>
          <em>AI</em>
        </span>
      )}
    </span>
  );

  if (!linked) {
    return mark;
  }

  return (
    <RouteLink to="/" className="logoLink" aria-label="Go to KtrlAI homepage">
      {mark}
    </RouteLink>
  );
}
