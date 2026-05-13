/** Flatten Supabase / PostgREST-style errors for UI and logs. */
export function formatSupabaseClientError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err !== "object" || err === null) return String(err);
  const o = err as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    statusCode?: unknown;
  };
  const parts = [
    typeof o.message === "string" ? o.message : null,
    typeof o.details === "string" ? o.details : null,
    typeof o.hint === "string" ? o.hint : null,
    o.statusCode != null ? `HTTP ${o.statusCode}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : JSON.stringify(err);
}
