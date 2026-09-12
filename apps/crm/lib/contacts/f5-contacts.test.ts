import { describe, expect, it } from "vitest";

import { contactCreateSchema, isValidCpf } from "@/lib/schemas/contacts";
import { decodeContactsCursor, encodeContactsCursor } from "@/app/api/v1/contacts/_handler";

describe("F5-CUSTOMER-360-001 contacts contract", () => {
  it("assina cursor HMAC e rejeita alteração", () => {
    const cursor = encodeContactsCursor({ last_activity_at: null, created_at: "2026-09-10T00:00:00.000Z", id: "contact-1" });
    expect(decodeContactsCursor(cursor)).toMatchObject({ id: "contact-1" });
    const [payload, signature] = cursor.split(".");
    expect(decodeContactsCursor(`${payload}x.${signature}`)).toBeNull();
  });

  it("valida E.164, CPF e rejeita payload inválido", () => {
    expect(contactCreateSchema.safeParse({ phone_number: "+351912345678", cpf: "529.982.247-25" }).success).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(contactCreateSchema.safeParse({ phone_number: "11999998888" }).success).toBe(false);
    expect(contactCreateSchema.safeParse({ cpf: "111.111.111-11" }).success).toBe(false);
  });
});
