import { createServer, IncomingMessage, ServerResponse } from "node:http";
import OpenAI from "openai";
import WebSocket from "ws";

const port = Number(process.env.PORT ?? 8000);
const apiKey = process.env.OPENAI_API_KEY;
const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET;

if (!apiKey || !webhookSecret) {
  throw new Error("Missing OPENAI_API_KEY or OPENAI_WEBHOOK_SECRET");
}

const client = new OpenAI({ apiKey });
const eventType = "realtime.call.incoming";
const acceptPayload = {
  type: "realtime",
  model: "gpt-realtime-2.1",
  instructions:
    "Você é um agente de atendimento amigável para o CRM Lumenva, em Portugal. Fale sempre em português europeu. " +
    "Primeiro, diga rapidamente que a ligação de teste funcionou. Depois disso, converse normalmente: escute o que a pessoa " +
    "pergunta e responda de verdade ao conteúdo, não repita frases prontas. Regras de voz: respostas de 1-2 frases, números " +
    "sempre por extenso, nunca dígitos soltos. Se perguntarem preço ou algo que você não sabe, diga que não tem essa " +
    "informação agora em vez de inventar. Se perguntarem se você é uma IA, admita que sim e continue ajudando. Só encerre a " +
    "ligação quando a pessoa disser explicitamente que quer desligar.",
  audio: {
    input: {
      // Configure turn detection as part of the SIP session accepted by the
      // REST endpoint. This makes each caller turn trigger a response without
      // relying on a post-connect session.update sideband race.
      // Keep server_vad for this focused fix: changing VAD and barge-in ordering
      // together would make it impossible to attribute any audio change cleanly.
      turn_detection: {
        type: "server_vad",
        create_response: true,
        interrupt_response: true,
      },
    },
    output: { voice: "alloy" },
  },
} as const;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function connectSideband(callId: string): Promise<void> {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, origin: "https://api.openai.com" },
  });

  type ActiveResponse = {
    id?: string;
    outputItemId?: string;
    audioEndMs: number;
    interrupted: boolean;
  };
  let activeResponse: ActiveResponse | undefined;
  // This process does not own a SIP/RTP playback queue. Keep the hook explicit so
  // a future local media adapter cannot leave already-buffered audio playing.
  const localAudioQueue: Buffer[] = [];
  const clearLocalAudioQueue = (): void => {
    localAudioQueue.length = 0;
  };
  const sendRealtimeEvent = (event: Record<string, unknown>): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  };
  const interruptActiveResponse = (): void => {
    if (!activeResponse || activeResponse.interrupted) return;
    activeResponse.interrupted = true;

    // The order is intentional: stop local playback, cancel generation, truncate
    // the assistant item to what was actually played, then clear provider audio.
    clearLocalAudioQueue();
    sendRealtimeEvent({ type: "response.cancel", response_id: activeResponse.id });
    if (activeResponse.outputItemId) {
      sendRealtimeEvent({
        type: "conversation.item.truncate",
        item_id: activeResponse.outputItemId,
        content_index: 0,
        audio_end_ms: activeResponse.audioEndMs,
      });
    }
    sendRealtimeEvent({ type: "output_audio_buffer.clear" });
  };

  const summarizeResponse = (event: Record<string, unknown>): string => {
    const response = (event.response ?? {}) as Record<string, unknown>;
    const output = Array.isArray(response.output) ? response.output : [];
    return JSON.stringify({
      event_id: event.event_id,
      response_id: response.id,
      status: response.status,
      status_details: response.status_details,
      conversation_id: response.conversation_id,
      output: output.map((item) => {
        const value = item as Record<string, unknown>;
        return {
          id: value.id,
          type: value.type,
          role: value.role,
          status: value.status,
          content: value.content,
        };
      }),
    });
  };

  ws.once("open", () => {
    console.error(`Realtime sideband open call_id=${callId}`);
    ws.send(JSON.stringify({ type: "response.create" }));
  });
  ws.on("message", (data) => {
    try {
      const event = JSON.parse(data.toString()) as Record<string, unknown>;
      const type = typeof event.type === "string" ? event.type : "unknown";
      if (type === "response.created") {
        const response = (event.response ?? {}) as Record<string, unknown>;
        activeResponse = {
          id: typeof response.id === "string" ? response.id : undefined,
          audioEndMs: 0,
          interrupted: false,
        };
      } else if (type === "response.output_item.added") {
        const response = (event.response ?? {}) as Record<string, unknown>;
        const item = (event.item ?? {}) as Record<string, unknown>;
        if (activeResponse && typeof response.id === "string" && !activeResponse.id) activeResponse.id = response.id;
        if (activeResponse && typeof item.id === "string" && item.type === "message") {
          activeResponse.outputItemId = item.id;
        }
      } else if (type === "response.audio.delta") {
        const audioEndMs = event.audio_end_ms;
        if (activeResponse && typeof audioEndMs === "number") activeResponse.audioEndMs = audioEndMs;
      } else if (type === "input_audio_buffer.speech_started") {
        interruptActiveResponse();
      } else if (type === "response.done") {
        console.error("sideband response.done", summarizeResponse(event));
        activeResponse = undefined;
      } else if (
        type === "error" ||
        type === "session.updated" ||
        type === "input_audio_buffer.speech_started" ||
        type === "input_audio_buffer.speech_stopped" ||
        type === "output_audio_buffer.started" ||
        type === "output_audio_buffer.stopped" ||
        type === "output_audio_buffer.cleared"
      ) {
        console.error("sideband event", type, type === "error" ? JSON.stringify(event) : "");
      }
    } catch {
      // ignore parse errors for unrelated frames
    }
  });
  ws.on("unexpected-response", (_request, response) => {
    console.error(
      `Realtime sideband handshake failed call_id=${callId} status=${response.statusCode} ${response.statusMessage ?? ""}`,
    );
  });
  ws.on("error", (error) => console.error("Realtime sideband error", error.message));
  ws.on("close", (code, reason) => {
    console.error(`Realtime sideband closed call_id=${callId} code=${code} reason=${reason.toString() || "<none>"}`);
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST") {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const rawBody = await readBody(request);
    const event = await client.webhooks.unwrap(rawBody, request.headers as Record<string, string>, webhookSecret);
    if (event.type === eventType) {
      const callId = (event as { data?: { call_id?: string } }).data?.call_id;
      if (!callId) throw new Error("Incoming event has no call_id");
      console.error(`realtime.call.incoming received call_id=${callId}`);
      const accepted = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(acceptPayload),
      });
      if (!accepted.ok) throw new Error(`Realtime accept failed (${accepted.status})`);
      console.error(`realtime.call.accepted call_id=${callId}`);
      void connectSideband(callId);
    }
    response.writeHead(200).end("ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    if (message.toLowerCase().includes("signature")) response.writeHead(400).end("Invalid signature");
    else {
      console.error("Webhook handling failed", message);
      response.writeHead(500).end("Server error");
    }
  }
}

createServer((request, response) => void handle(request, response)).listen(port, () => {
  console.error(`voice-sip-test listening on http://localhost:${port}`);
});
