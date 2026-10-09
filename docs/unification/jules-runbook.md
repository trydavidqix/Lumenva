# Jules Runbook

This document outlines the GitHub Actions checks and the procedure for creating Jules sessions for the Lumenva CRM, Social, and Dropshipping unification project.

## GitHub Actions CI Checks

Tests and builds for this project run **exclusively** on GitHub Actions. Windows does not execute local validations. The current CI checks include:

*   **Typecheck:** `pnpm typecheck`
*   **Linting:** `pnpm lint`, `pnpm lint:channels`
*   **Unit Tests:** `pnpm test:unit`
*   **Database Invariants (RLS/Governance):** `pnpm test:db` (Runs in a separate job against a dedicated pgvector/pg17 database).
*   **Harness Consistency:** `pnpm test:harness && pnpm harness:check`
*   **GCP CI (F8):** Dry-run build and push using Workload Identity Federation (F8 F7 rules apply, no real deploy or push in CI).

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
*   **`sourceContext`**: Must be set to the GitHub source branch for the specific task.
*   **Prompt**: The prompt should clearly specify the task ID, base SHA, and the exact allowlist of files to be modified.

**Example Request (Conceptual):**
```http
POST https://jules.googleapis.com/v1alpha/sessions
Content-Type: application/json

{
  "sourceContext": {
    "git": {
      "repository": "trydavidqix/Lumenva",
      "branch": "main"
    }
  },
  "prompt": "Execute Task NN. Use the provided SHA as a base. Modify only the allowed files..."
}
```

## Source Access and Blockers

Access to each private source repository (Lumenva, Lumenva-Legacy, lumenva-social, lumenva-social-brain, Drop) is separate. If access to any required source is missing during a task, the task must report a `BLOCKED_SOURCE_ACCESS` state and stop execution for that capability. Do not invent alternative code or mock integrations that change the contract if source access is blocked.
