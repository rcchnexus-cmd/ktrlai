const chartPalette = ["#f59e0b", "#f97316", "#dc2626", "#8b5cf6", "#6366f1"];

export function TrafficChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="chartBox emptyChart">
        <strong>Waiting for live tracker events</strong>
        <p>Install the tracker or open your connected site to begin recording AI access evidence.</p>
      </div>
    );
  }

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
            <stop offset="0%" stopColor="#ff9f1c" />
            <stop offset="100%" stopColor="#ff2d20" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="url(#trafficLine)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${points} 100,100`} fill="rgba(255, 159, 28, 0.12)" />
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
  if (!data.length) {
    return (
      <div className="distribution emptyChart">
        <strong>Waiting for operator signals</strong>
        <p>Operator share appears after KtrlAI receives AI access events.</p>
      </div>
    );
  }

  return (
    <div className="distribution">
      {data.map((item) => (
        <div className="distributionRow" key={item.label}>
          <div>
            <span style={{ background: chartPalette[data.indexOf(item) % chartPalette.length] }} />
            {item.label}
          </div>
          <div className="barTrack" aria-label={`${item.label} ${item.value}%`}>
            <span style={{ width: `${item.value}%`, background: chartPalette[data.indexOf(item) % chartPalette.length] }} />
          </div>
          <strong>{item.value}%</strong>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ data = [] }) {
  if (!data.length) {
    return (
      <div className="miniBars emptyChart">
        <strong>Waiting for request volume</strong>
        <p>Frequency bars appear after live or sample traffic is available.</p>
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="miniBars">
      {data.map((item) => (
        <div key={item.label} className="miniBar">
          <span style={{ height: `${Math.max((item.value / max) * 100, 8)}%`, background: chartPalette[data.indexOf(item) % chartPalette.length] }} />
          <em>{item.label}</em>
        </div>
      ))}
    </div>
  );
}
