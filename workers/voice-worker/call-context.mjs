const contexts = new Map();

export function putCallContext(callId, context) {
  if (!callId) throw new Error("callId is required");
  contexts.set(callId, Object.freeze({ ...context }));
}

export function getCallContext(callId) {
  return contexts.get(callId) ?? null;
}

export function deleteCallContext(callId) {
  contexts.delete(callId);
}

export function activeCallCount() {
  return contexts.size;
}

export function extractPatterCallEndpoints(data) {
  const callId = String(data?.callId ?? data?.call_id ?? data?.id ?? "").trim();
  const caller = String(data?.caller ?? data?.from ?? data?.from_number ?? "").trim();
  const called = String(data?.callee ?? data?.to ?? data?.to_number ?? "").trim();
  if (!callId || !caller || !called) throw new Error("Patter call event missing callId/caller/called");
  return { callId, caller, called };
}
