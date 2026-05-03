export default function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`statusBadge ${normalized}`}>{status}</span>;
}
