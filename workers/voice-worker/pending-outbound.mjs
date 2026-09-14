const E164 = /^\+[1-9]\d{6,14}$/;

export function createPendingOutboundRegistry(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0 ? options.ttlMs : 60_000;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const entries = new Map();

  function purgeExpired() {
    const cutoff = now() - ttlMs;
    for (const [key, entry] of entries) {
      if (entry.reservedAt <= cutoff) entries.delete(key);
    }
  }

  return {
    reserve({ toE164, voiceCallId, organizationId }) {
      purgeExpired();
      if (typeof toE164 !== "string" || !E164.test(toE164)) throw new Error("invalid_e164");
      if (typeof voiceCallId !== "string" || !voiceCallId.trim()) throw new Error("voice_call_id_required");
      if (typeof organizationId !== "string" || !organizationId.trim()) throw new Error("organization_id_required");
      if (entries.has(toE164)) throw new Error("outbound_destination_busy");
      const entry = {
        toE164,
        voiceCallId: voiceCallId.trim(),
        organizationId: organizationId.trim(),
        reservedAt: now(),
      };
      entries.set(toE164, entry);
      return entry;
    },
    release(toE164, voiceCallId) {
      const entry = entries.get(toE164);
      if (entry && (voiceCallId === undefined || entry.voiceCallId === voiceCallId)) entries.delete(toE164);
    },
    consume(toE164) {
      purgeExpired();
      const entry = entries.get(toE164);
      if (!entry) return null;
      entries.delete(toE164);
      return entry;
    },
    size() {
      purgeExpired();
      return entries.size;
    },
  };
}
