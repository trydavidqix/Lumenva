import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { buildGraphView, type KnowledgeGraph } from "@lumenva/knowledge-graph";
import { CoreRuntime } from "./core-runtime.js";

export type CoreHttpServer = {
  url: string;
  close(): Promise<void>;
};

export async function startCoreHttpServer(
  runtime: CoreRuntime,
  port: number,
  options: { graph?: Pick<KnowledgeGraph, "search"> } = {},
): Promise<CoreHttpServer> {
  const server = createServer((request, response) => {
    void route(runtime, request, response, options);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Core HTTP server did not expose a TCP address");
  }
  return { url: `http://127.0.0.1:${address.port}`, close: () => closeServer(server) };
}

async function route(
  runtime: CoreRuntime,
  request: IncomingMessage,
  response: ServerResponse,
  options: { graph?: Pick<KnowledgeGraph, "search"> },
): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") return send(response, 200, runtime.health());
    if (request.method === "GET" && url.pathname === "/events") return send(response, 200, { events: runtime.eventsList() });
    if (request.method === "GET" && url.pathname === "/graph") {
      if (!options.graph) return send(response, 503, { error: "GRAPH_UNAVAILABLE" });
      const namespace = url.searchParams.get("namespace") ?? "";
      const query = url.searchParams.get("query") ?? "";
      const rawLimit = url.searchParams.get("limit") ?? "20";
      const limit = Number(rawLimit);
      if (!namespace || !query || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return send(response, 400, { error: "INVALID_GRAPH_QUERY" });
      }
      return send(response, 200, await buildGraphView(options.graph, { namespace, query, limit }));
    }
    if (request.method === "GET" && /^\/tasks\/[^/]+$/.test(url.pathname)) {
      const task = runtime.task(decodeURIComponent(url.pathname.slice("/tasks/".length)));
      return task ? send(response, 200, task) : send(response, 404, { error: "TASK_NOT_FOUND" });
    }
    if (request.method === "GET" && /^\/executions\/[^/]+$/.test(url.pathname)) {
      const execution = runtime.execution(decodeURIComponent(url.pathname.slice("/executions/".length)));
      return execution ? send(response, 200, execution) : send(response, 404, { error: "EXECUTION_NOT_FOUND" });
    }
    if (request.method === "POST" && url.pathname === "/tasks") {
      const input = await readJson(request) as {
        id: string; type: string; idempotencyKey: string; traceId: string; payload: unknown;
      };
      const result = await runtime.startTask(input);
      return send(response, result.created ? 201 : 200, result.task);
    }
    return send(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof SyntaxError ? "INVALID_JSON" : error instanceof Error ? error.message : "REQUEST_FAILED";
    send(response, 400, { error: message });
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
