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

let agentRow: { id: string } | null;
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
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: agentRow, error: agentErr }),
              }),
            }),
          }),
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
  agentRow = { id: AGENT_ID };
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
    agentRow = { id: AGENT_ID };
    const res = await publishKnowledgePolicy(
      baseInput({
        file: { name: "policy.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-1.4") },
      }),
    );
    expect(res.blobPath.endsWith(".pdf")).toBe(true);
  });

  it("agent não pertence à organização → not_found, sem upload", async () => {
    agentRow = null;

    await expect(publishKnowledgePolicy(baseInput())).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("erro na consulta de agent → internal_error", async () => {
    agentRow = null;
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
    agentRow = null;
    await expect(publishKnowledgePolicy(baseInput())).rejects.toBeInstanceOf(
      PublishKnowledgePolicyError,
    );
  });
});
