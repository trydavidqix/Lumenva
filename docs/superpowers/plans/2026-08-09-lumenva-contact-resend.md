# Lumenva Contact Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver validated contact-form messages to `contato@lumenva.pt` through Resend, with visitor acknowledgement, from a dedicated Vercel website project.

**Architecture:** A client contact-form component posts JSON to a same-origin Node.js route handler. The handler validates a shared Zod schema, applies a Redis-backed rate limit, and invokes a server-only Resend client to send a team notification and acknowledgement. The website deploys separately from the CRM with `website/` as the Vercel root directory.

**Tech Stack:** Next.js 16 App Router, React 19, Zod 4, Resend SDK, Upstash Redis rate limiting, Vercel, Cloudflare DNS.

## Global Constraints

- Keep `RESEND_API_KEY`, Redis credentials, and all provider responses server-only.
- Send team notifications only to `contato@lumenva.pt`.
- Use a verified `@lumenva.pt` sender configured as `RESEND_FROM_EMAIL`.
- Preserve the existing uncommitted website presentation changes.
- Do not modify the CRM, Supabase, WAHA, or the shared Vercel CRM project.
- Add no public API route without Zod validation and rate limiting.

---

### Task 1: Define and test the contact request contract

**Files:**
- Create: `website/lib/contact-form.ts`
- Create: `website/tests/unit/contact-form.test.ts`

**Interfaces:**
- Produces: `contactRequestSchema`, `ContactRequest`, and `parseContactRequest(input)`.
- Consumed by: `website/app/api/contact/route.ts` and `website/components/sections/ContactForm.tsx`.

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, test } from "vitest";
import { parseContactRequest } from "@/lib/contact-form";

describe("parseContactRequest", () => {
  test("accepts a complete consented contact request", () => {
    expect(parseContactRequest({ name: "Ana", company: "Lumenva", email: "ana@example.com", whatsapp: "+351910000000", consent: true }).success).toBe(true);
  });

  test("rejects a request without consent", () => {
    expect(parseContactRequest({ name: "Ana", company: "Lumenva", email: "ana@example.com", whatsapp: "+351910000000", consent: false }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails because the module is missing**

Run: `pnpm test website/tests/unit/contact-form.test.ts`

Expected: FAIL with an unresolved `@/lib/contact-form` module.

- [ ] **Step 3: Implement the minimal Zod schema**

```ts
import { z } from "zod";

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  whatsapp: z.string().trim().min(8).max(32),
  consent: z.literal(true),
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;
export const parseContactRequest = (input: unknown) => contactRequestSchema.safeParse(input);
```

- [ ] **Step 4: Run the contact contract test**

Run: `pnpm test website/tests/unit/contact-form.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract and its tests**

```bash
git add website/lib/contact-form.ts website/tests/unit/contact-form.test.ts
git commit -m "feat(website): validate contact requests"
```

### Task 2: Create the server-only Resend delivery route

**Files:**
- Create: `website/lib/resend.ts`
- Create: `website/app/api/contact/route.ts`
- Create: `website/tests/unit/contact-route.test.ts`
- Modify: `website/package.json`
- Modify: `website/pnpm-lock.yaml`

**Interfaces:**
- Consumes: `ContactRequest` and `parseContactRequest` from `website/lib/contact-form.ts`.
- Produces: `POST /api/contact` returning `{ data: { accepted: true } }` or a safe `{ error: { message } }` response.

- [ ] **Step 1: Write the failing route tests for valid and invalid submissions**

```ts
import { expect, test, vi } from "vitest";

vi.mock("@/lib/resend", () => ({
  sendContactEmails: vi.fn().mockResolvedValue(undefined),
}));

test("POST /api/contact accepts a valid request", async () => {
  const { POST } = await import("@/app/api/contact/route");
  const response = await POST(new Request("http://localhost/api/contact", { method: "POST", body: JSON.stringify({ name: "Ana", company: "Lumenva", email: "ana@example.com", whatsapp: "+351910000000", consent: true }) }));
  expect(response.status).toBe(202);
});
```

- [ ] **Step 2: Run the test to verify it fails because the route is missing**

Run: `pnpm test website/tests/unit/contact-route.test.ts`

Expected: FAIL with an unresolved contact route.

- [ ] **Step 3: Add Resend and implement server-only delivery**

Run: `pnpm add resend`

Implement `sendContactEmails(request)` in `website/lib/resend.ts` using `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Send one notification to `contato@lumenva.pt` and one acknowledgement to `request.email`. Implement `POST` with a Node.js runtime, JSON parsing, schema validation, and safe 400/500 responses.

- [ ] **Step 4: Add Redis rate limiting before email delivery**

Run: `pnpm add @upstash/ratelimit @upstash/redis`

Use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the route. Limit each client IP to five contact attempts per hour. Return HTTP 429 with a generic retry message before calling Resend.

- [ ] **Step 5: Run the route tests**

Run: `pnpm test website/tests/unit/contact-route.test.ts`

Expected: PASS, including the invalid-input and rate-limit cases.

- [ ] **Step 6: Commit the route and delivery layer**

```bash
git add website/app/api/contact/route.ts website/lib/resend.ts website/package.json website/pnpm-lock.yaml website/tests/unit/contact-route.test.ts
git commit -m "feat(website): send contact requests with Resend"
```

### Task 3: Connect the existing contact page to the API

**Files:**
- Create: `website/components/sections/ContactForm.tsx`
- Create: `website/tests/components/contact-form.test.tsx`
- Modify: `website/app/contato/page.tsx`
- Modify: `website/components/sections/InnerPages.module.css`

**Interfaces:**
- Consumes: the contact field names from `ContactRequest`.
- Consumes: `POST /api/contact`.
- Produces: accessible pending, success, and retry states for the visitor.

- [ ] **Step 1: Write the failing client-component test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ContactForm } from "@/components/sections/ContactForm";

test("submits the completed form and announces success", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { accepted: true } }), { status: 202 })));
  const user = userEvent.setup();
  render(<ContactForm />);
  await user.type(screen.getByLabelText(/nome/i), "Ana");
  await user.type(screen.getByLabelText(/empresa/i), "Lumenva");
  await user.type(screen.getByLabelText(/e-mail/i), "ana@example.com");
  await user.type(screen.getByLabelText(/whatsapp/i), "+351910000000");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /enviar solicitação/i }));
  expect(await screen.findByText(/recebemos sua solicitação/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails because the component is missing**

Run: `pnpm test website/tests/components/contact-form.test.tsx`

Expected: FAIL with an unresolved `ContactForm` module.

- [ ] **Step 3: Implement the minimal client form**

Create a `"use client"` component that serializes `FormData`, calls `/api/contact`, disables the submit button while pending, and renders a live success or generic retry message. Replace only the existing static `<form>` block in `website/app/contato/page.tsx` with `<ContactForm />`; retain the page copy and visual changes already present.

- [ ] **Step 4: Run the component test**

Run: `pnpm test website/tests/components/contact-form.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the form integration**

```bash
git add website/components/sections/ContactForm.tsx website/tests/components/contact-form.test.tsx website/app/contato/page.tsx website/components/sections/InnerPages.module.css
git commit -m "feat(website): submit Lumenva contact form"
```

### Task 4: Provision Vercel, Resend, and domain records

**Files:**
- Modify: Vercel project settings for `lumenva-website` only.
- Modify: Cloudflare DNS records requested by Resend for `lumenva.pt`.

**Interfaces:**
- Provides: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` to the website deployment.
- Provides: a verified Resend domain and a production Vercel deployment rooted at `website/`.

- [ ] **Step 1: Create the dedicated Vercel project**

Create `lumenva-website` in the `trydavidqixs-projects` team, connect `trydavidqix/CRM`, choose branch `feat/lumenva-website`, and set Root Directory to `website`.

- [ ] **Step 2: Add Resend and Redis through Vercel integrations**

Install the Resend integration to provision `RESEND_API_KEY`. Provision a free Upstash Redis integration for the website project and restrict credentials to Production and Preview.

- [ ] **Step 3: Verify the sender domain in Resend**

Add `lumenva.pt` in Resend Domains. Add every MX, SPF, and DKIM record Resend supplies to Cloudflare DNS exactly as supplied. Wait until Resend reports the domain verified, then set `RESEND_FROM_EMAIL` to `Lumenva <contato@lumenva.pt>`.

- [ ] **Step 4: Deploy and attach the website domain**

Deploy the branch. Attach `lumenva.pt` and `www.lumenva.pt` to `lumenva-website`; update only the DNS records Vercel requests.

- [ ] **Step 5: Verify deployment configuration without revealing secrets**

Run: `vercel inspect <website-production-url> --scope trydavidqixs-projects`

Expected: Production deployment is `Ready`; Vercel shows the website project and expected aliases.

### Task 5: Verify the real user journey

**Files:**
- Modify: `website/tests/e2e/routes.spec.ts`
- Create: `.superpowers/evidence/lumenva-contact-success.png`

**Interfaces:**
- Consumes: deployed website URL, verified sender domain, and a real external receiver.

- [ ] **Step 1: Add the contact success journey to Playwright**

Extend the contact E2E test to fill every field, consent, submit, and assert the visible success status. Use a test-only receiver address controlled by the operator; do not commit it.

- [ ] **Step 2: Run unit, type, lint, and production build checks**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Run the production contact journey and capture evidence**

Run the Playwright contact test against the deployed website. Confirm the team notification arrives at `contato@lumenva.pt` and the visitor acknowledgement arrives at the test receiver. Capture the visible success state in `.superpowers/evidence/lumenva-contact-success.png` without including personal data.

- [ ] **Step 4: Commit tests and evidence**

```bash
git add website/tests/e2e/routes.spec.ts .superpowers/evidence/lumenva-contact-success.png
git commit -m "test(website): verify contact email delivery"
```
