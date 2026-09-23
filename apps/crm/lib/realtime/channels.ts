/**
 * Canonical realtime channel factory helpers.
 * Centralizes channel-name strings so every consumer stays in sync.
 */

// Supabase client is deprecated for Realtime. This module used to provide channel instances,
// but with SSE we just pass channel names to the hook directly.
// We preserve the file/export to avoid breaking existing unused references or types if any,
// though `alertsPlatform` usage should be migrated or rely on the hook taking strings directly.

export function alertsPlatform() {
  return "alerts-platform";
}
