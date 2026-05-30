import StatusBadge from "./StatusBadge.jsx";

function formatValue(value, fallback = "0") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return value;
}

function getInitials(value) {
  const text = String(value || "AI").trim();
  const parts = text.split(/[\s-]+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function AIOperatorIntelligence({
  operator = "Awaiting operator",
  trustLevel = "Observed",
  activity = "No live volume yet",
  permission = "Monitor",
  detail = "Operator profiles sharpen as crawler evidence arrives.",
  operators = []
}) {
  const visibleOperators = operators.length ? operators.slice(0, 4) : [operator];

  return (
    <article className="ktSignatureWidget ktOperatorIntelWidget" data-signal="operator-intelligence">
      <div className="ktSignatureHeader">
        <span className="ktSignatureIcon" aria-hidden="true">{getInitials(operator)}</span>
        <div>
          <span className="eyebrow">AI Operator Intelligence</span>
          <h2>{operator}</h2>
        </div>
      </div>
      <div className="ktOperatorMeta">
        <span><strong>{trustLevel}</strong><em>Trust level</em></span>
        <span><strong>{activity}</strong><em>Activity</em></span>
        <span><strong>{permission}</strong><em>Permission</em></span>
      </div>
      <p>{detail}</p>
      <div className="ktOperatorStack" aria-label="Observed operators">
        {visibleOperators.map((item, index) => (
          <span key={`${item}-${index}`}>
            <i aria-hidden="true">{getInitials(item)}</i>
            <strong>{item}</strong>
            <em>{index === 0 ? trustLevel : index === 3 ? "Flagged" : "Observed"}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

export function GovernanceCoverage({
  coverage = 0,
  assetsProtected = 0,
  policiesActive = 0,
  trainingRules = 0,
  licensingRules = 0,
  detail = "Coverage reflects configured access rules and protected crawler scopes."
}) {
  const safeCoverage = Math.max(0, Math.min(100, Number(coverage) || 0));

  return (
    <article className="ktSignatureWidget ktGovernanceCoverageWidget" data-signal="governance-coverage">
      <span className="eyebrow">Governance Coverage</span>
      <div className="ktCoverageLayout">
        <div className="ktCoverageRing" style={{ "--coverage": `${safeCoverage}%` }}>
          <strong>{safeCoverage}%</strong>
          <span>Coverage</span>
        </div>
        <div className="ktCoverageStats">
          <span><strong>{assetsProtected}</strong><em>Assets protected</em></span>
          <span><strong>{policiesActive}</strong><em>Policies active</em></span>
          <span><strong>{trainingRules}</strong><em>Training rules</em></span>
          <span><strong>{licensingRules}</strong><em>Licensing rules</em></span>
        </div>
      </div>
      <p>{detail}</p>
    </article>
  );
}

export function AIVisibilityScore({
  score = "Pending",
  discoverableAssets = 0,
  directiveCoverage = "Not scanned",
  aiReadiness = "Pending",
  detail = "Visibility intelligence combines discoverability, directives, provider signals, and content structure."
}) {
  const scoreLabel = typeof score === "number" ? `${score}%` : score;

  return (
    <article className="ktSignatureWidget ktVisibilityScoreWidget" data-signal="visibility-score">
      <span className="eyebrow">AI Visibility Score</span>
      <div className="ktScoreHeader">
        <strong>{scoreLabel}</strong>
        <span>{aiReadiness}</span>
      </div>
      <div className="ktScoreStats">
        <span><strong>{discoverableAssets}</strong><em>Discoverable assets</em></span>
        <span><strong>{directiveCoverage}</strong><em>Directive coverage</em></span>
      </div>
      <p>{detail}</p>
    </article>
  );
}

export function LicensingReadiness({
  score = 0,
  eligibleAssets = 0,
  chargeReadyAssets = 0,
  opportunityLevel = "Planning",
  detail = "Licensing readiness is a beta planning signal, not a live payout or enforcement claim."
}) {
  const safeScore = typeof score === "number" ? `${score}%` : score;

  return (
    <article className="ktSignatureWidget ktLicensingWidget" data-signal="licensing-readiness">
      <span className="eyebrow">Licensing Readiness</span>
      <div className="ktScoreHeader">
        <strong>{safeScore}</strong>
        <span>{opportunityLevel}</span>
      </div>
      <div className="ktScoreStats">
        <span><strong>{eligibleAssets}</strong><em>Eligible assets</em></span>
        <span><strong>{chargeReadyAssets}</strong><em>Charge-ready assets</em></span>
      </div>
      <p>{detail}</p>
    </article>
  );
}

export function AIAccessDecisions({
  allowed = 0,
  denied = 0,
  training = 0,
  licensing = 0,
  review = 0,
  detail = "Access decisions show how crawler evidence is converted into workflow metadata."
}) {
  const total = [allowed, denied, training, licensing, review].reduce((sum, value) => sum + Number(value || 0), 0);
  const items = [
    ["Allowed", allowed, "allowed"],
    ["Denied", denied, "denied"],
    ["Training", training, "training"],
    ["Licensing", licensing, "licensing"],
    ["Review", review, "review"]
  ];

  return (
    <article className="ktSignatureWidget ktAccessDecisionsWidget" data-signal="access-decisions">
      <span className="eyebrow">AI Access Decisions</span>
      <div className="ktDecisionBars" aria-label="AI access decision breakdown">
        {items.map(([label, value, tone]) => {
          const width = total ? Math.max(8, Math.round((Number(value || 0) / total) * 100)) : 8;

          return (
            <div className={`ktDecisionBar ${tone}`} key={label}>
              <span><strong>{formatValue(value)}</strong>{label}</span>
              <i style={{ width: `${width}%` }} aria-hidden="true" />
            </div>
          );
        })}
      </div>
      <p>{detail}</p>
    </article>
  );
}

export function CrawlerEvidenceStream({
  rows = [],
  emptyTitle = "Waiting for live tracker events",
  emptyDetail = "Install the tracker or open your connected site to begin recording AI access evidence.",
  compact = false
}) {
  if (!rows.length) {
    return (
      <div className="ktEvidenceEmpty">
        <strong>{emptyTitle}</strong>
        <p>{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div className={compact ? "ktEvidenceStream compact" : "ktEvidenceStream"} role="table" aria-label="Crawler evidence stream">
      <div className="ktEvidenceHeader" role="row">
        <span>Time</span>
        <span>Operator</span>
        <span>Action</span>
        <span>Policy</span>
        <span>Status</span>
      </div>
      {rows.map((row, index) => (
        <article className="ktEvidenceRow" key={row.id || `${row.operator}-${row.path}-${index}`} role="row">
          <time>{row.time || row.timestamp || "Now"}</time>
          <div className="ktEvidenceOperator">
            <i aria-hidden="true">{getInitials(row.operator || row.bot)}</i>
            <strong>{row.operator || row.bot || "Unknown"}</strong>
          </div>
          <code>{row.path || row.page || row.action || "/"}</code>
          <span>{row.policy || row.policyAction || row.rule || "Monitor"}</span>
          <StatusBadge status={row.status || row.risk || "Observed"} />
        </article>
      ))}
    </div>
  );
}
