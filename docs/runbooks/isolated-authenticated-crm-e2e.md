# CRM authenticated E2E — isolated Supabase preview (no Docker)

Real login, MFA and authorization require **real isolated Auth and database**.
Mocks or placeholder API keys cannot pass this gate. The connected Supabase
account currently exposes only the primary CRM project, not a disposable
preview. Do not run the credential seed against the primary project.

Configure GitHub repository variables: E2E_PREVIEW_REF (new distinct 20-char
project ref), E2E_PRODUCTION_REF (primary project ref), E2E_PREVIEW_URL
(https://<E2E_PREVIEW_REF>.supabase.co).

Configure GitHub secrets: E2E_PREVIEW_ANON_KEY, E2E_PREVIEW_SERVICE_ROLE_KEY,
E2E_PREVIEW_DB_URL (direct db.<ref>.supabase.co or pooler postgres.<ref>).
Use an empty disposable preview with CRM baseline and enabled Supabase MFA.
No token is committed, printed or uploaded in artifacts.

The workflow refuses missing keys/preview/production mixups, then verifies
REAL Supabase admin Auth and PostgreSQL schema read-only before any seed.
Only after that does it start Firebase's local DEMO Auth emulator, build with
the preview URL embedded, seed disposable users and run auth + RBAC Playwright.

The signup/Mailpit flow is a distinct integration and is NOT marked covered
by this smaller authenticated gate. Preview creation can incur charges and
needs a separate cost confirmation. No deployment or merging is performed.
