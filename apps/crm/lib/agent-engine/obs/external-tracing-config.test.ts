import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: {
    LANGSMITH_API_KEY: "langsmith-test-key",
    LANGSMITH_ENDPOINT: "https://api.smith.langchain.com",
    LANGSMITH_PROJECT: "deskcomm-test",
    LANGSMITH_WORKSPACE_ID: "workspace-test",
  },
  resolveFeature: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: state.env }));
vi.mock("../platform/features", () => ({
  resolveAiPlatformFeature: state.resolveFeature,
}));

import { resolveExternalTracingConfig } from "./external-tracing-config";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

describe("resolveExternalTracingConfig", () => {
  beforeEach(() => {
    Object.assign(state.env, {
      LANGSMITH_API_KEY: "langsmith-test-key",
      LANGSMITH_ENDPOINT: "https://api.smith.langchain.com",
      LANGSMITH_PROJECT: "deskcomm-test",
      LANGSMITH_WORKSPACE_ID: "workspace-test",
    });
    state.resolveFeature.mockResolvedValue({ mode: "shadow", config: {}, killed: false });
  });

  it("disables tracing when the API key is missing", async () => {
    state.env.LANGSMITH_API_KEY = "";

    await expect(resolveExternalTracingConfig({ organizationId: ORGANIZATION_ID }))
      .resolves.toEqual({ enabled: false });
  });

  it("disables tracing when the LangSmith kill switch has fired", async () => {
    state.resolveFeature.mockResolvedValue({ mode: "off", config: {}, killed: true });

    await expect(resolveExternalTracingConfig({ organizationId: ORGANIZATION_ID }))
      .resolves.toEqual({ enabled: false });
  });

  it("disables tracing when the LangSmith feature is off", async () => {
    state.resolveFeature.mockResolvedValue({ mode: "off", config: {}, killed: false });

    await expect(resolveExternalTracingConfig({ organizationId: ORGANIZATION_ID }))
      .resolves.toEqual({ enabled: false });
  });

  it.each(["shadow", "canary", "on"] as const)("enables tracing in %s mode with an API key", async (mode) => {
    state.resolveFeature.mockResolvedValue({ mode, config: {}, killed: false });

    await expect(resolveExternalTracingConfig({ organizationId: ORGANIZATION_ID }))
      .resolves.toEqual({
        enabled: true,
        apiKey: "langsmith-test-key",
        endpoint: "https://api.smith.langchain.com",
        project: "deskcomm-test",
        workspaceId: "workspace-test",
      });
  });

  it("fails safe when the configured endpoint is invalid", async () => {
    state.env.LANGSMITH_ENDPOINT = "not a URL";

    await expect(resolveExternalTracingConfig({ organizationId: ORGANIZATION_ID }))
      .resolves.toEqual({ enabled: false });
  });
});
