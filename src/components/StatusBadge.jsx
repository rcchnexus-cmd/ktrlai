export default function StatusBadge({ status }) {
  const label = String(status || "Unknown");
  const normalized = label.toLowerCase().replace(/[\s_]+/g, "-");
  return <span className={`statusBadge ${normalized}`}>{label}</span>;
}
