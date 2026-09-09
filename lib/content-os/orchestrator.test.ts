import { describe, expect, it, vi } from "vitest";

import {
  createEditorialRun,
  createEditorialStages,
  createProductionEditorialAdapters,
  createDryRunEditorialStages,
  runEditorialWorkflow,
  EditorialWorkflowError,
} from "./orchestrator";

describe("Content OS editorial orchestrator", () => {
  it("encadeia todas as etapas e publica apenas em modo dry-run", async () => {
    const result = await runEditorialWorkflow(
      createEditorialRun({ organizationId: crypto.randomUUID(), topic: "Agentes de IA" }),
      { stages: createDryRunEditorialStages() },
    );
    expect(result.status).toBe("succeeded");
    expect(Object.keys(result.outputs)).toEqual(["discovery", "research", "factcheck", "editor", "quality_gate", "publisher"]);
    expect(result.outputs.publisher).toMatchObject({ published: false, dryRun: true });
  });

  it("permite retomar no mesmo estágio após falha transitória sem repetir etapas concluídas", async () => {
    const calls: string[] = [];
    let researchAttempts = 0;
    const stages = createDryRunEditorialStages();
    stages.discovery = vi.fn(async () => { calls.push("discovery"); return { ok: true }; });
    stages.research = vi.fn(async () => {
      calls.push("research");
      researchAttempts += 1;
      if (researchAttempts === 1) throw Object.assign(new Error("rate limited"), { code: "rate_limited", retryable: true });
      return { ok: true };
    });
    const first = await runEditorialWorkflow(createEditorialRun({ organizationId: crypto.randomUUID(), topic: "X" }), { stages });
    expect(first.status).toBe("waiting_retry");
    const second = await runEditorialWorkflow(first, { stages });
    expect(second.status).toBe("succeeded");
    expect(calls.filter((call) => call === "discovery")).toHaveLength(1);
    expect(calls.filter((call) => call === "research")).toHaveLength(2);
  });

  it("injeta adapters reais sem acoplar o orquestrador a providers", async () => {
    const calls: string[] = [];
    const stages = createEditorialStages({
      discovery: async () => { calls.push("discovery"); return { signal: "s1" }; },
      research: async () => { calls.push("research"); return { evidence: ["e1"] }; },
      factcheck: async () => { calls.push("factcheck"); return { verdict: "pass" }; },
      editor: async () => { calls.push("editor"); return { title: "Título" }; },
      publisher: async () => { calls.push("publisher"); return { published: false, dryRun: true }; },
    });
    const result = await runEditorialWorkflow(createEditorialRun({ organizationId: crypto.randomUUID(), topic: "X" }), { stages });
    expect(result.status, JSON.stringify(result.errors)).toBe("succeeded");
    expect(calls).toEqual(["discovery", "research", "factcheck", "editor", "publisher"]);
    expect(result.outputs.editor).toMatchObject({ title: "Título" });
  });

  it("monta pipeline de produção somente com sinais e evidências persistidos", async () => {
    const org = crypto.randomUUID();
    const adapters = createProductionEditorialAdapters({
      listSignals: async () => [],
      listEvidence: async () => [{ id: "e1", url: "https://example.test", title: "Fonte", publisher: "Fonte", kind: "primary", retrievedAt: new Date().toISOString(), supportsClaimIds: [] }],
    });
    const result = await runEditorialWorkflow(createEditorialRun({ organizationId: org, topic: "IA" }), { stages: createEditorialStages(adapters) });
    expect(result.status, JSON.stringify(result.errors)).toBe("succeeded");
    expect(result.outputs.discovery).toMatchObject({ mode: "persisted" });
    expect(result.outputs.publisher).toMatchObject({ published: false, dryRun: true });
  });

  it("bloqueia no quality gate sem executar publisher", async () => {
    const publisher = vi.fn(async () => ({ published: true }));
    const stages = createDryRunEditorialStages();
    stages.quality_gate = async () => ({ passed: false, blocked: true, reason: "claim sem evidência" });
    stages.publisher = publisher;
    const result = await runEditorialWorkflow(createEditorialRun({ organizationId: crypto.randomUUID(), topic: "X" }), { stages });
    expect(result.status).toBe("blocked");
    expect(publisher).not.toHaveBeenCalled();
  });

  it("falha definitivamente depois do limite de tentativas", async () => {
    const stages = createDryRunEditorialStages();
    stages.research = async () => { throw new EditorialWorkflowError("upstream unavailable", "upstream_unavailable", true); };
    const result = await runEditorialWorkflow(createEditorialRun({ organizationId: crypto.randomUUID(), topic: "X" }), { stages, maxAttempts: 2 });
    expect(result.status).toBe("waiting_retry");
    const terminal = await runEditorialWorkflow(result, { stages, maxAttempts: 2 });
    expect(terminal.status).toBe("failed");
    expect(terminal.attempts.research).toBe(2);
  });
});
