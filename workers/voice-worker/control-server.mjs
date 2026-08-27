import http from "node:http";

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_768) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function startVoiceControlServer({ phone, agent, secret, liveEnabled, port }) {
  const server = http.createServer(async (req, res) => {
    const path = (req.url ?? "").split("?", 1)[0];
    if (req.method === "GET" && path === "/healthz") {
      return json(res, 200, { status: "ok", live_enabled: liveEnabled });
    }
    if (req.method !== "POST" || path !== "/v1/calls") return json(res, 404, { error: "not_found" });
    if (!safeEqual(req.headers["x-internal-secret"] ?? "", secret)) return json(res, 401, { error: "unauthenticated" });
    if (!liveEnabled) return json(res, 409, { error: "voice_live_disabled" });

    try {
      const body = await readJson(req);
      const to = String(body?.to_e164 ?? "").trim();
      if (!/^\+[1-9]\d{6,14}$/.test(to)) return json(res, 422, { error: "invalid_e164" });
      const firstMessage = typeof body?.first_message === "string" ? body.first_message.trim().slice(0, 500) : undefined;
      await phone.call({
        to,
        agent,
        ...(firstMessage ? { firstMessage } : {}),
        wait: false,
      });
      return json(res, 202, { accepted: true });
    } catch (error) {
      return json(res, 500, { error: error instanceof Error ? error.message : "outbound_failed" });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve(server));
  });
}
