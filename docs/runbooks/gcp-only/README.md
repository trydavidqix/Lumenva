# GCP-Only Infrastructure Runbooks

This directory contains runbooks and operational documentation for the GCP-only infrastructure track (F8) of Lumenva/DeskcommCRM.

## Scope
The runbooks in this directory dictate the standards for:
- CI/CD via Workload Identity Federation (WIF) and Artifact Registry
- Secret Manager Wiring and Redaction
- Cloud Logging and Observability
- Cloud Scheduler and Cloud Tasks
- IAM Least Privilege Policies

## Runbooks
- [`f8-c0-integration-runbook.md`](./f8-c0-integration-runbook.md) - The main integration and activation runbook for transitioning from the F8-C0 (dry-run) phase to F8-H1 (live provisioning).

> **Note:** All automation and testing against these components must operate in `dry-run` or against local emulators until the human gate (F8-H1) is passed. No live credentials or secrets are permitted in this codebase.
