import { describe, expect, it } from "vitest";
import { encryptCpfSql } from "./cpf";

describe("CPF encryption boundary", () => {
  it("fails closed when the encryption RPC is unavailable", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function missing" } }),
    } as never;

    await expect(encryptCpfSql(supabase, "52998224725")).rejects.toThrow("CPF encryption unavailable");
  });

  it("rejects an empty ciphertext", async () => {
    const supabase = {
      rpc: async () => ({ data: new Uint8Array(), error: null }),
    } as never;

    await expect(encryptCpfSql(supabase, "52998224725")).rejects.toThrow("CPF encryption unavailable");
  });
});
