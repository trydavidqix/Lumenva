import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { signInWithPassword } from "./signInWithPassword";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("signInWithPassword — transição para Firebase client", () => {
  it("encaminha credenciais válidas ao fluxo do cliente sem chamar Supabase", async () => {
    const result = await signInWithPassword({
      email: "person@example.com",
      password: "valid-password-123",
    });

    expect(result).toEqual({ ok: false, error: "use_firebase_client" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("continua validando a entrada antes do encaminhamento", async () => {
    const result = await signInWithPassword({ email: "not-an-email", password: "" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("validation_error");
    expect(createClient).not.toHaveBeenCalled();
  });
});
