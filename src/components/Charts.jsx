export function TrafficChart({ data = [] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - (item.value / max) * 82 - 8;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chartBox">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="AI traffic over time">
        <defs>
          <linearGradient id="trafficLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5B8CFF" />
            <stop offset="100%" stopColor="#9B6DFF" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="url(#trafficLine)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${points} 100,100`} fill="rgba(91, 140, 255, 0.12)" />
      </svg>
      <div className="chartLabels">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DistributionChart({ data = [] }) {
  return (
    <div className="distribution">
      {data.map((item) => (
        <div className="distributionRow" key={item.label}>
          <div>
            <span style={{ background: item.color }} />
            {item.label}
          </div>
          <div className="barTrack" aria-label={`${item.label} ${item.value}%`}>
            <span style={{ width: `${item.value}%`, background: item.color }} />
          </div>
          <strong>{item.value}%</strong>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ data = [] }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="miniBars">
      {data.map((item) => (
        <div key={item.label} className="miniBar">
          <span style={{ height: `${Math.max((item.value / max) * 100, 8)}%` }} />
          <em>{item.label}</em>
        </div>
      ))}
    </div>
  );
}
