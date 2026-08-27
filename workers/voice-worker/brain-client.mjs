function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value.trim();
}

async function postJson(url, secret, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code ?? payload?.code ?? `http_${response.status}`;
    const error = new Error(`voice brain request failed: ${code}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data ?? payload;
}

export function createVoiceBrainClient(env = process.env) {
  const baseUrl = required(env.VOICE_CONTROL_PLANE_URL, "VOICE_CONTROL_PLANE_URL").replace(/\/$/, "");
  const secret = required(env.INTERNAL_SECRET, "INTERNAL_SECRET");
  return {
    resolveContext(input) {
      return postJson(`${baseUrl}/api/internal/voice/context`, secret, input);
    },
    runTurn(input) {
      return postJson(`${baseUrl}/api/internal/voice/turn`, secret, input);
    },
    recordEvent(input) {
      return postJson(`${baseUrl}/api/internal/voice/event`, secret, input);
    },
  };
}
