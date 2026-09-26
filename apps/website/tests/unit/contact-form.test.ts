import { describe, expect, test } from "vitest";
import { parseContactRequest } from "@/lib/contact-form";

describe("parseContactRequest", () => {
  test("accepts a complete consented contact request", () => {
    expect(
      parseContactRequest({
        name: "Ana",
        company: "Lumenva",
        email: "ana@example.com",
        whatsapp: "+351910000000",
        consent: true,
      }).success,
    ).toBe(true);
  });

  test("rejects a request without consent", () => {
    expect(
      parseContactRequest({
        name: "Ana",
        company: "Lumenva",
        email: "ana@example.com",
        whatsapp: "+351910000000",
        consent: false,
      }).success,
    ).toBe(false);
  });
});
