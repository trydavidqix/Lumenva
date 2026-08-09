import { expect, test, vi } from "vitest";
import { limitContactRequest } from "@/lib/contact-rate-limit";

vi.mock("@/lib/resend", () => ({
  sendContactEmails: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/contact-rate-limit", () => ({
  limitContactRequest: vi.fn().mockResolvedValue({ limited: false }),
}));

test("POST /api/contact accepts a valid request", async () => {
  const { POST } = await import("@/app/api/contact/route");
  const response = await POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Ana",
        company: "Lumenva",
        email: "ana@example.com",
        whatsapp: "+351910000000",
        consent: true,
      }),
    }),
  );

  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toEqual({ data: { accepted: true } });
});

test("POST /api/contact rejects invalid requests", async () => {
  const { POST } = await import("@/app/api/contact/route");
  const response = await POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({ consent: false }),
    }),
  );

  expect(response.status).toBe(400);
});

test("POST /api/contact blocks excessive requests before sending email", async () => {
  vi.mocked(limitContactRequest).mockResolvedValueOnce({ limited: true });
  const { POST } = await import("@/app/api/contact/route");
  const response = await POST(
    new Request("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Ana",
        company: "Lumenva",
        email: "ana@example.com",
        whatsapp: "+351910000000",
        consent: true,
      }),
    }),
  );

  expect(response.status).toBe(429);
});
