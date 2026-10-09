# Jules Runbook

This document outlines the GitHub Actions checks and the procedure for creating Jules sessions for the Lumenva CRM, Social, and Dropshipping unification project.

## GitHub Actions CI Checks

Tests and builds for this project run **exclusively** on GitHub Actions. Windows does not execute local validations. The current CI checks include:

*   **`ci.yml` (verify & invariants jobs):**
    *   **Typecheck:** `pnpm typecheck`
    *   **Linting:** `pnpm lint`
    *   **Channel Provider Leak:** `pnpm lint:channels`
    *   **Harness Consistency:** `pnpm test:harness && pnpm harness:check`
    *   **Unit Tests:** `pnpm test:unit`
    *   **Kit self-host (bash):** `pnpm test:shell`
    *   **RLS/governance invariants:** `pnpm test:db` (Runs in a separate job against a pgvector/pg17 database).
*   **`gcp-ci.yml` (verify-and-build & invariants jobs):**
    *   Repeats typecheck, lint, and unit tests.
    *   **GCP Auth:** Authenticates via OIDC only outside of pull requests (`github.event_name != 'pull_request'`) and only when required variables (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) are configured.
    *   **Docker Build:** Performs a dry-run Docker build (`push: false`). It does not perform an actual push or publish.

## Tracking Pull Requests

Pull requests (PRs) created by Jules are reviewed by the Owner. To track the progress and status of PRs:
1. Navigate to the `Pull requests` tab on the GitHub repository.
2. Select the PR associated with the specific task.
3. Review the code changes and check the status of the GitHub Actions in the `Checks` tab at the bottom of the PR. Wait for all checks to complete before considering the PR ready for merge.

## Jules API Session Creation

**Note:** The installed CLI on this machine failed to authenticate due to network/proxy issues and an OAuth client error. Therefore, the CLI is not considered functional. Sessions must be created via the API.

To create an individual session for Jules, use the following API flow. **Do not use `--parallel` and do not enable auto-merge.** Create one session per task.

**Endpoint:**
`POST https://jules.googleapis.com/v1alpha/sessions`

**Request Payload Configuration:**
*   **`sourceContext`**: Must use the official schema to define the source and starting branch.
*   **`prompt`** and **`title`**: Must clearly outline the task ID, base SHA, and precise files to modify. Use `AUTO_CREATE_PR` mode to create PRs automatically (this mode creates PRs, but does not auto-merge).

**Example Request (Conceptual):**
```http
POST https://jules.googleapis.com/v1alpha/sessions
Content-Type: application/json

{
  "sourceContext": {
    "source": "sources/github/trydavidqix/Lumenva",
    "githubRepoContext": {
      "startingBranch": "main"
    }
  },
  "title": "Task NN",
  "prompt": "Execute Task NN. Use the provided SHA as a base. Modify only the allowed files...",
  "automationMode": "AUTO_CREATE_PR"
}
```

## Source Access and Blockers

Access to each private source repository (Lumenva, Lumenva-Legacy, lumenva-social, lumenva-social-brain, Drop) is separate. If access to any required source is missing during a task, the task must report a `BLOCKED_SOURCE_ACCESS` state and stop execution for that capability. Do not invent alternative code or mock integrations that change the contract if source access is blocked.
