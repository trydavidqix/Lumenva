import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Characterizes the ingestion logic that used to live inline in
 * POST /api/v1/ai/knowledge/sources/upload (task 4, AI platform phase 3
 * extraction): MIME/size validation, agent tenant ownership, storage cleanup
 * on extraction failure, source insert, and knowledge_source.updated
 * emission. These assertions were derived from the pre-extraction route and
 * must hold identically after the extraction.
 */

const uploadMock = vi.fn();
const removeMock = vi.fn();
const rpcMock = vi.fn();
const insertMock = vi.fn();
const ingestPolicyFileMock = vi.fn();

let agentTable: Array<{ id: string; organization_id: string }>;
let agentErr: { message: string } | null;
let insertResult: { data: { id: string } | null; error: { message: string } | null };

const { FakePdfExtractError } = vi.hoisted(() => {
  class FakePdfExtractError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PdfExtractError";
    }
  }
  return { FakePdfExtractError };
});

vi.mock("@/lib/ai/rag/ingest/policy", () => ({
  ingestPolicyFile: (...args: unknown[]) => ingestPolicyFileMock(...args),
  PdfExtractError: FakePdfExtractError,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "ai_agents") {
        return {
          // Progressive candidate-list narrowing (NOT a "compare against a
          // possibly-unset filters object" design): each `.eq(col, val)`
          // filters down from the full agentTable. This makes the mock
          // mutation-sensitive to a dropped filter — if a real `.eq(...)`
          // call is removed from the code under test, the candidate list
          // stays broader (matches MORE rows), exactly like a real Postgres
          // query with one fewer WHERE clause would. A "compare against
          // filters.foo" design gets this backwards: an unset filter key
          // compares as `undefined`, which never equals a real column
          // value, so it silently narrows to ZERO matches instead of
          // widening — hiding a dropped filter instead of exposing it.
          select: () => {
            let candidates = agentTable;
            const builder = {
              eq: (col: "id" | "organization_id", val: string) => {
                candidates = candidates.filter((row) => row[col] === val);
                return builder;
              },
              maybeSingle: async () => {
                if (agentErr) return { data: null, error: agentErr };
                return { data: candidates[0] ?? null, error: null };
              },
            };
            return builder;
          },
        };
      }
      if (table === "ai_knowledge_sources") {
        return {
          insert: (row: Record<string, unknown>) => {
            insertMock(row);
            return {
              select: () => ({
                single: async () => insertResult,
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
      }),
    },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PdfExtractError } from "@/lib/ai/rag/ingest/policy";
import { PublishKnowledgePolicyError, publishKnowledgePolicy } from "./publish-policy";

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ORG_ID = "33333333-3333-4333-8333-333333333333";
const AGENT_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "66666666-6666-4666-8666-666666666666";

function baseInput(overrides: Partial<Parameters<typeof publishKnowledgePolicy>[0]> = {}) {
  return {
    organizationId: ORG_ID,
    agentId: AGENT_ID,
    actorUserId: USER_ID,
    name: "Política de reembolso",
    file: {
      name: "policy.md",
      mimeType: "text/markdown",
      bytes: Buffer.from("# Política\nConteúdo."),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  agentTable = [{ id: AGENT_ID, organization_id: ORG_ID }];
  agentErr = null;
  insertResult = { data: { id: SOURCE_ID }, error: null };
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  rpcMock.mockResolvedValue({ error: null });
  ingestPolicyFileMock.mockResolvedValue({ chunkCount: 3 });
});

describe("publishKnowledgePolicy", () => {
  it("uploads, valida extração, insere a fonte e emite knowledge_source.updated", async () => {
    const result = await publishKnowledgePolicy(baseInput());

    expect(result.sourceId).toBe(SOURCE_ID);
    expect(result.blobPath).toMatch(new RegExp(`^${ORG_ID}/[0-9a-f-]+\\.md$`));

    expect(uploadMock).toHaveBeenCalledWith(
      result.blobPath,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "text/markdown", upsert: false }),
    );

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_ID,
        agent_id: AGENT_ID,
        source_type: "policy",
        name: "Política de reembolso",
        status: "ready",
        source_metadata: expect.objectContaining({
          filename: "policy.md",
          blob_path: result.blobPath,
          version: 1,
          uploaded_by: USER_ID,
          mime_type: "text/markdown",
          size_bytes: baseInput().file.bytes.length,
          chunk_count: 3,
        }),
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "emit_event",
      expect.objectContaining({
        p_event_type: "knowledge_source.updated",
        p_entity_kind: "ai_knowledge_source",
        p_entity_id: SOURCE_ID,
        p_payload: expect.objectContaining({
          knowledge_source_id: SOURCE_ID,
          agent_id: AGENT_ID,
          source_type: "policy",
        }),
        p_organization_id: ORG_ID,
      }),
    );

    expect(removeMock).not.toHaveBeenCalled();
  });

  it("rejeita arquivo acima de 20MB sem tocar storage/DB", async () => {
    const oversized = Buffer.alloc(20 * 1024 * 1024 + 1);

    await expect(
      publishKnowledgePolicy(
        baseInput({ file: { name: "big.pdf", mimeType: "application/pdf", bytes: oversized } }),
      ),
    ).rejects.toMatchObject({ code: "payload_too_large", status: 413 });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejeita MIME/extensão não suportada sem tocar storage/DB", async () => {
    await expect(
      publishKnowledgePolicy(
        baseInput({
          file: { name: "malware.exe", mimeType: "application/x-msdownload", bytes: Buffer.from("x") },
        }),
      ),
    ).rejects.toMatchObject({ code: "unsupported_media_type", status: 415 });

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("aceita PDF por extensão mesmo com MIME genérico octet-stream via nome", async () => {
    const res = await publishKnowledgePolicy(
      baseInput({
        file: { name: "policy.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.4") },
      }),
    );
    expect(res.blobPath.endsWith(".pdf")).toBe(true);
  });

  it("upload no storage falha → internal_error, sem insert/emit e sem tentar limpar (nada foi de fato enviado)", async () => {
    uploadMock.mockResolvedValue({ error: { message: "bucket unreachable" } });

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });

    expect(insertMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("agent não existe em lugar nenhum → not_found, sem upload", async () => {
    agentTable = [];

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("agent existe mas pertence a OUTRA organização → not_found, sem upload (prova que o filtro organization_id é levado a sério)", async () => {
    // Same agent id, but owned by a different org than the one in the request.
    agentTable = [{ id: AGENT_ID, organization_id: OTHER_ORG_ID }];

    await expect(
      publishKnowledgePolicy(baseInput({ organizationId: ORG_ID })),
    ).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("erro na consulta de agent → internal_error", async () => {
    agentTable = [];
    agentErr = { message: "db down" };

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("extração falha com PdfExtractError → unprocessable_entity e limpa o blob", async () => {
    ingestPolicyFileMock.mockRejectedValue(new PdfExtractError("no text layer"));

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "unprocessable_entity",
      status: 422,
    });

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("extração falha com erro genérico → internal_error e limpa o blob", async () => {
    ingestPolicyFileMock.mockRejectedValue(new Error("boom"));

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("insert da fonte falha → internal_error e limpa o blob já enviado", async () => {
    insertResult = { data: null, error: { message: "insert failed" } };

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "internal_error",
      status: 500,
    });

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("emit_event falhar não bloqueia — retorna sourceId normalmente", async () => {
    rpcMock.mockResolvedValue({ error: { message: "rpc down" } });

    const result = await publishKnowledgePolicy(baseInput());
    expect(result.sourceId).toBe(SOURCE_ID);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("erros lançados são instâncias de PublishKnowledgePolicyError", async () => {
    agentTable = [];
    await expect(publishKnowledgePolicy(baseInput())).rejects.toBeInstanceOf(
      PublishKnowledgePolicyError,
    );
  });
});
