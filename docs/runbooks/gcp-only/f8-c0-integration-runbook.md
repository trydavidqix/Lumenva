# F8-C0 Integration Runbook (GCP-only)

**Status:** F8-C0 (Dry-Run / Placeholder State)

This runbook aggregates the contracts, validation matrices, and operational steps for activating the GCP infrastructure for Lumenva/DeskcommCRM. At the F8-C0 stage, **no real resources are created**, no database connections carry live data, and no real secrets exist. The goal is to provide a deterministic, verifiable dry-run environment.

## 1. Subtask Summaries (F8-J1 to F8-J5)

- **F8-J1 (CI Workflows)**: Implemented `.github/workflows/gcp-ci.yml`. Validates code via `typecheck`, `lint`, `test:unit`, and `test:db`. Uses OIDC (`google-github-actions/auth@v2`) for GCP authentication instead of long-lived service account keys.
- **F8-J2 (Secret Manager)**: Created placeholder wiring. Secrets are mapped logically (e.g., `LUMENVA_SECRET_NAME`). The runtime throws explicitly if a secret is missing, and logs redact secret values completely.
- **F8-J3 (Artifact Registry)**: Modified `.github/workflows/publish-image.yml` to perform Docker builds with `push: false`. Images are tagged immutably, and the flow is authenticated via Workload Identity Federation (WIF).
- **F8-J4 (Cloud Logging/Trace)**: Logging components strictly output structured JSON to standard streams without heavy GCP-specific logging dependencies. All telemetry data uses placeholders and redacts PII/Tokens.
- **F8-J5 (Scheduler & Tasks)**: Handlers for scheduled tasks are structured to be idempotent and retryable. For C0, these run against local fakes/emulators and require explicit service identity validation.

## 2. Configuration & Dry-Run Matrix

Before proceeding to F8-H1, verify the following configuration values are set to their dry-run modes:
- **GitHub Actions**: Ensure `push: false` in Docker build steps.
- **Secret Manager**: Environment variables use the `LUMENVA_SECRET_` prefix. Tests validate placeholder behavior.
- **Service Accounts**: Only non-privileged, placeholder service account names are referenced in documentation and workflows.
- **Workload Identity Federation**: The pool and provider IDs in `.github/workflows/publish-image.yml` are marked as `PLACEHOLDER` or use dummy values.

## 3. IAM Least Privilege Matrix

When F8-H1 is executed, the Owner must provision IAM according to this exact matrix:

| Role | Permitted Actions | Prohibited Actions |
|---|---|---|
| **CI Publisher** | `roles/artifactregistry.writer` (Push images) | Cannot read secrets, access DB, or modify IAM. |
| **Runtime** | `roles/secretmanager.secretAccessor` (Read specific secrets), Write Logs | Cannot list secrets, create IAM, or build images. |
| **Worker** | Read specific secrets, Invoke tasks | Cannot alter schemas or bypass RLS. |
| **Scheduler/Invoker** | `roles/cloudtasks.enqueuer` | Cannot query DB or alter IAM. |

## 4. Rollback and Manual Gate Procedure

### Rollback (C0 / C1 Phase)
- **Code/Config**: Revert the GitHub Actions changes or disable the specific OIDC step via environment variable removal.
- **Secrets**: Clear placeholder environment variables locally or in CI.
- **Jobs**: Disable local task emulators.

### F8-H1 Activation (Manual Gate)
Activating real resources requires the **Owner** to:
1. Create real Workload Identity Pools and Providers in GCP.
2. Update GitHub repository variables (`vars.GCP_WORKLOAD_IDENTITY_PROVIDER`, `vars.GCP_SERVICE_ACCOUNT`).
3. Create real Secrets in Google Cloud Secret Manager.
4. Set `push: true` in `publish-image.yml` only after the Artifact Registry repository is provisioned and IAM is granted.
5. Apply IAM roles based strictly on the Least Privilege Matrix above.

**IMPORTANT:** F8-C0 explicitly prohibits automated deployment or script-based provisioning of live GCP resources. All activations occur manually via the F8-H1 gate.
