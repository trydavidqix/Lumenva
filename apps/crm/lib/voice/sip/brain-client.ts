/**
 * Authenticated HTTP client from the SIP/BYOC worker process to the CRM's
 * internal voice control plane — the TypeScript, SIP-shaped sibling of
 * `workers/voice-worker/brain-client.mjs` (same auth header, same error
 * shape, same fetch/timeout discipline). Only `resolveContext`/`recordEvent`
 * are needed here: turn/transcript handling belongs to the STT/TTS/Pipecat
 * side, which is `BLOCKED EXTERNAL` in this repo (see
 * `workers/voice-sip-worker/README.md`) — this client only closes the
 * `/context` + `/event` half of the loop.
 */

export interface SipBrainClientConfig {
  /** CRM base URL, e.g. https://crm.example.com */
  baseUrl: string;
  secret: string;
  /** Request timeout in ms. Defaults to 30_000, same as the Telnyx worker's client. */
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface SipContextRequest {
  provider_call_id: string;
  connection_id: string;
  caller_e164: string;
  called_e164: string;
  direction: "inbound" | "outbound";
}

export interface SipContextResponse {
  voice_call_id: string;
  contact_id: string | null;
  caller_kind: "known" | "unknown";
  locale: string;
}

export interface SipEventRequest {
  voice_call_id: string;
  connection_id: string;
  phone_e164: string;
  state: "connecting" | "active" | "held" | "transferring" | "completed" | "failed" | "canceled";
  provider_event_id: string;
  provider_call_id?: string;
  occurred_at?: string;
}

export interface SipTurnRequest {
  voice_call_id: string;
  technical_phone_e164: string;
  transcript: string;
}

export type SipTurnResponse = { kind: "reply"; text: string } | { kind: "blocked"; reason: string };

export interface SipBrainRequestError extends Error {
  status: number;
  payload: unknown;
}

export interface SipBrainClient {
  resolveContext(input: SipContextRequest): Promise<SipContextResponse>;
  recordEvent(input: SipEventRequest): Promise<{ recorded: true }>;
  runTurn(input: SipTurnRequest): Promise<SipTurnResponse>;
}

function required(value: string, name: string): string {
  if (!value.trim()) throw new Error(`[voice] ${name} is required`);
  return value.trim();
}

async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  secret: string,
  body: unknown,
  timeoutMs: number,
): Promise<TResponse> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (payload as { error?: { code?: string }; code?: string } | null)?.error?.code
      ?? (payload as { code?: string } | null)?.code
      ?? `http_${response.status}`;
    const error = new Error(`[voice] SIP brain request failed: ${code}`) as SipBrainRequestError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return ((payload as { data?: TResponse } | null)?.data ?? payload) as TResponse;
}

export function createSipVoiceBrainClient(config: SipBrainClientConfig): SipBrainClient {
  const baseUrl = required(config.baseUrl, "baseUrl").replace(/\/+$/, "");
  const secret = required(config.secret, "secret");
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;

  return {
    resolveContext(input) {
      return postJson<SipContextResponse>(fetchImpl, `${baseUrl}/api/internal/voice/context`, secret, input, timeoutMs);
    },
    recordEvent(input) {
      return postJson<{ recorded: true }>(fetchImpl, `${baseUrl}/api/internal/voice/event`, secret, input, timeoutMs);
    },
    runTurn(input) {
      return postJson<SipTurnResponse>(fetchImpl, `${baseUrl}/api/internal/voice/turn`, secret, input, timeoutMs);
    },
  };
}
