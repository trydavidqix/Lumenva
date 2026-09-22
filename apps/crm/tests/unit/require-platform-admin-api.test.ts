import { describe, expect, it, vi, beforeEach } from "vitest";

import { requirePlatformAdminApi } from "../../lib/auth/require-platform-admin-api";
import { resolvePlatformAdmin } from "../../lib/auth/requirePlatformAdmin";

vi.mock("../../lib/auth/requirePlatformAdmin", () => ({
  resolvePlatformAdmin: vi.fn(),
}));

describe("requirePlatformAdminApi", () => {
  const requestId = "req-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated 401 when result is unauthenticated", async () => {
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "unauthenticated" });

    const result = await requirePlatformAdminApi({ requestId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const data = await result.response.json();
      expect(data.error.code).toBe("unauthenticated");
      expect(data.error.message).toBe("Faça login para continuar.");
    }
  });

  it("returns forbidden 403 when result is forbidden", async () => {
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "forbidden" });

    const result = await requirePlatformAdminApi({ requestId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const data = await result.response.json();
      expect(data.error.code).toBe("forbidden");
      expect(data.error.message).toBe("Só o dono do servidor pode realizar esta ação.");
    }
  });

  it("returns forbidden 403 when result is mfa_required", async () => {
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "mfa_required" });

    const result = await requirePlatformAdminApi({ requestId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const data = await result.response.json();
      expect(data.error.code).toBe("forbidden");
      expect(data.error.message).toBe("Só o dono do servidor pode realizar esta ação.");
    }
  });

  it("returns internal_error 500 when result is internal_error", async () => {
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "internal_error" });

    const result = await requirePlatformAdminApi({ requestId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(500);
      const data = await result.response.json();
      expect(data.error.code).toBe("internal_error");
      expect(data.error.message).toBe("Erro ao validar permissões de administrador.");
    }
  });

  it("returns ok true and context when result is ok", async () => {
    const mockContext = {
      user: { id: "u-1" } as any,
      platformAdmin: { user_id: "u-1", scope: "*", mfa_required: true },
    };
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: true, context: mockContext });

    const result = await requirePlatformAdminApi({ requestId });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context).toEqual(mockContext);
    }
  });
});
