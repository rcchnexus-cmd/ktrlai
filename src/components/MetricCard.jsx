export default function MetricCard({ label, value, change, tone = "neutral" }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
      <em className={`metricChange ${tone}`}>{change}</em>
    </article>
  );
}
