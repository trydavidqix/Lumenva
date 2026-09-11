export const BASELINE_APPLIED_THROUGH = 160;
export const BASELINE_APPLIED_THROUGH_TIMESTAMP = "20260907120000";

/** Only the explicit migration sequence suffix is authoritative; timestamps are fallback. */
export function isBaselineCovered(file) {
  const sequence = file.match(/_(\d+)_/)?.[1];
  if (sequence) return Number(sequence) <= BASELINE_APPLIED_THROUGH;
  return file.slice(0, 14) <= BASELINE_APPLIED_THROUGH_TIMESTAMP;
}

export function isSupabaseManagedUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "pooler.supabase.com" || host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
