import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateBearerToken } from "@/lib/mcp/auth";
import {
  HUMAN_ROLES,
  PAPEIS_HUMANOS,
  isHumanRole,
  type ActorRole,
  type HumanRole,
} from "@/lib/auth/types";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const TOKEN = "dsk_test_secret";

function mockToken(scopes: string[]): void {
  const row = {
    id: "token-1",
    organization_id: "org-1",
    scopes,
    revoked_at: null,
    expires_at: null,
  };
  const chain = {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    then: (resolve: (value: { error: null }) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };
  vi.mocked(createAdminClient).mockReturnValue({ from: () => chain } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("F3 role domains", () => {
  it("separa o conjunto de papéis humanos do papel de ator interno", () => {
    const human: HumanRole = "admin";
    const actor: ActorRole = "ai_operator";

    expect(human).toBe("admin");
    expect(actor).toBe("ai_operator");
    expect(HUMAN_ROLES).toEqual(PAPEIS_HUMANOS);
    expect(HUMAN_ROLES).toEqual(["viewer", "agent", "manager", "admin"]);
    expect(isHumanRole("admin")).toBe(true);
    expect(isHumanRole("ai_operator")).toBe(false);
    expect(isHumanRole("platform_admin")).toBe(false);
  });

  it("mantém ai_operator válido no caminho MCP de ator interno", async () => {
    mockToken(["mcp:read", "actor:ai_agent", "role:ai_operator"]);

    const result = await validateBearerToken(`Bearer ${TOKEN}`);

    expect(result.role).toBe("ai_operator");
    expect(result.actor).toMatchObject({ type: "ai_agent", role: "ai_operator" });
  });

  it("rejeita ai_operator sem o marcador de ator interno", async () => {
    mockToken(["mcp:read", "role:ai_operator"]);

    await expect(validateBearerToken(`Bearer ${TOKEN}`)).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it("rejeita role:platform_admin em vez de rebaixá-lo silenciosamente para agent", async () => {
    mockToken(["mcp:read", "role:platform_admin"]);

    await expect(validateBearerToken(`Bearer ${TOKEN}`)).rejects.toMatchObject({
      httpStatus: 401,
    });
  });
});
