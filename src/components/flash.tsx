export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return <div className={ok && !error ? "alert ok" : "alert"}>{error || ok}</div>;
}
