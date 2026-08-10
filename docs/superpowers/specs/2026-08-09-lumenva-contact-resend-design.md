# Lumenva Contact Resend Design

## Goal

Deliver contact-form submissions from the Lumenva website to `contato@lumenva.pt` and send a confirmation to the visitor.

## Scope

- The public `/contato` form submits to a same-origin Next.js route.
- The server validates all submitted fields and sends transactional email through Resend.
- Resend sends from the verified `lumenva.pt` domain.
- Secrets remain server-side in Vercel environment variables.

## Request flow

1. The browser submits the form to `POST /api/contact`.
2. The route validates name, company, email, WhatsApp, and consent with Zod.
3. The route sends the Lumenva team notification to `contato@lumenva.pt`.
4. The route sends a short acknowledgement to the visitor's supplied email.
5. The browser shows a clear success or retry message without exposing provider errors.

## Security and reliability

- The Resend API key is read only by the server from `RESEND_API_KEY`.
- `RESEND_FROM_EMAIL` is a verified `@lumenva.pt` sender address.
- The API route rejects malformed input and missing consent.
- The route does not return Resend error bodies or input values in errors.
- The public endpoint uses the project's existing rate-limit mechanism where available.

## Infrastructure

- Create a dedicated Vercel project named `lumenva-website`, rooted at `website/` and connected to `feat/lumenva-website`.
- Keep the CRM deployment separate from the institutional website deployment.
- Verify `lumenva.pt` in Resend with the records supplied by Resend, managed in Cloudflare.
- Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel Production and Preview.
- Deploy the `feat/lumenva-website` branch after verification.

## Acceptance criteria

- A valid form submission reaches `contato@lumenva.pt`.
- The visitor receives an acknowledgement from the verified domain.
- Invalid input, lack of consent, and unavailable email delivery receive a safe user-facing result.
- The API key is absent from browser bundles, source control, logs, and responses.
