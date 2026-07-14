export default function Notice({ tone = 'error', children }) {
  if (!children) return null;
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
