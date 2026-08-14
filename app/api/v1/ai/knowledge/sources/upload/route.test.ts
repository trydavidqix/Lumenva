// @vitest-environment node
//
// Multipart real (File/FormData) precisa do realm do Node — jsdom (default do
// projeto) corrompe o corpo ao passar pelo parser de multipart do NextRequest.
// Ver app/api/v1/ai/skills/import/route.test.ts para a mesma nota.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import {
  publishKnowledgePolicy,
  PublishKnowledgePolicyError,
} from "@/lib/ai/rag/publication/publish-policy";
import type * as PublishPolicyModule from "@/lib/ai/rag/publication/publish-policy";
import type { AuthUser } from "@/lib/auth/types";

/**
 * POST /api/v1/ai/knowledge/sources/upload — auth/HTTP parsing owned by the
 * route; ingestion (MIME/size, agent ownership, storage, source insert,
 * event emission) owned by `publishKnowledgePolicy` (task 4 extraction).
 * These assertions were captured from the pre-extraction inline route
 * behavior and must hold identically after the extraction.
 */

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ai/rag/publication/publish-policy", async () => {
  const actual = await vi.importActual<typeof PublishPolicyModule>(
    "@/lib/ai/rag/publication/publish-policy",
  );
  return {
    ...actual,
    publishKnowledgePolicy: vi.fn(),
  };
});

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "66666666-6666-4666-8666-666666666666";

function mockAuthzOk() {
  const user: AuthUser = {
    id: USER_ID,
    email: "a@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    organizations: [{ organization_id: ORG_ID, organization_name: "Org", role: "manager" }],
  };
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user,
    org: { orgId: ORG_ID, name: "Org", role: "manager" },
  });
}

function postReq(opts: {
  file?: { name: string; type: string; content?: string };
  agentId?: string;
  name?: string;
  omitFile?: boolean;
}) {
  const form = new FormData();
  if (!opts.omitFile) {
    const f = opts.file ?? { name: "policy.md", type: "text/markdown", content: "# Política" };
    form.set("file", new File([f.content ?? "conteúdo"], f.name, { type: f.type }));
  }
  if (opts.agentId !== undefined) form.set("agent_id", opts.agentId);
  if (opts.name !== undefined) form.set("name", opts.name);
  return new NextRequest("http://localhost/api/v1/ai/knowledge/sources/upload", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    count: 1,
    limit: 20,
    window_sec: 60,
  });
});

describe("POST /api/v1/ai/knowledge/sources/upload", () => {
  it("sem auth → repassa authz.response", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: fail("unauthenticated", "Auth required.", 401, {}),
    });
    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: AGENT_ID, name: "Política" }));
    expect(res.status).toBe(401);
    expect(publishKnowledgePolicy).not.toHaveBeenCalled();
  });

  it("acima do limite de rate limit → 429 rate_limited com Retry-After, sem chamar o serviço", async () => {
    mockAuthzOk();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      count: 21,
      limit: 20,
      window_sec: 60,
    });

    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: AGENT_ID, name: "Política" }));

    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("rate_limited");
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(checkRateLimit).toHaveBeenCalledWith(`ai_knowledge_upload:${ORG_ID}`, 20, 60);
    expect(publishKnowledgePolicy).not.toHaveBeenCalled();
  });

  it("upload válido → chama publishKnowledgePolicy com org/actor de requireRole (nunca do form), responde 201", async () => {
    mockAuthzOk();
    vi.mocked(publishKnowledgePolicy).mockResolvedValue({
      sourceId: SOURCE_ID,
      blobPath: `${ORG_ID}/abc.md`,
    });

    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: AGENT_ID, name: "Política de reembolso" }));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; blob_path: string } };
    expect(body.data).toEqual({ id: SOURCE_ID, blob_path: `${ORG_ID}/abc.md` });
    expect(body).not.toHaveProperty("data.data");

    expect(publishKnowledgePolicy).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(publishKnowledgePolicy).mock.calls[0]!;
    expect(input.organizationId).toBe(ORG_ID); // org SEMPRE de requireRole, nunca do form
    expect(input.actorUserId).toBe(USER_ID);
    expect(input.agentId).toBe(AGENT_ID);
    expect(input.name).toBe("Política de reembolso");
    expect(input.file.name).toBe("policy.md");
    expect(input.file.mimeType).toBe("text/markdown");
    expect(Buffer.isBuffer(input.file.bytes)).toBe(true);
  });

  it("campo 'file' ausente → 400 invalid_request, sem chamar o serviço", async () => {
    mockAuthzOk();
    const { POST } = await import("./route");
    const res = await POST(postReq({ omitFile: true, agentId: AGENT_ID, name: "Política" }));
    expect(res.status).toBe(400);
    expect(publishKnowledgePolicy).not.toHaveBeenCalled();
  });

  it("agent_id inválido (não UUID) → 422 validation_failed, sem chamar o serviço", async () => {
    mockAuthzOk();
    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: "not-a-uuid", name: "Política" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_failed");
    expect(publishKnowledgePolicy).not.toHaveBeenCalled();
  });

  it("name fora do range (2-120 chars) → 422 validation_failed, sem chamar o serviço", async () => {
    mockAuthzOk();
    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: AGENT_ID, name: "a" }));
    expect(res.status).toBe(422);
    expect(publishKnowledgePolicy).not.toHaveBeenCalled();
  });

  it("serviço rejeita (MIME não suportado) → status/code do PublishKnowledgePolicyError repassados", async () => {
    mockAuthzOk();
    vi.mocked(publishKnowledgePolicy).mockRejectedValue(
      new PublishKnowledgePolicyError(
        "unsupported_media_type",
        415,
        "Tipo de arquivo não suportado. Envie PDF ou Markdown (.pdf, .md).",
      ),
    );

    const { POST } = await import("./route");
    const res = await POST(
      postReq({ agentId: AGENT_ID, name: "Política", file: { name: "x.exe", type: "application/x-msdownload" } }),
    );

    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unsupported_media_type");
  });

  it("serviço lança erro desconhecido → 500 internal_error", async () => {
    mockAuthzOk();
    vi.mocked(publishKnowledgePolicy).mockRejectedValue(new Error("boom"));

    const { POST } = await import("./route");
    const res = await POST(postReq({ agentId: AGENT_ID, name: "Política" }));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("internal_error");
  });
});
