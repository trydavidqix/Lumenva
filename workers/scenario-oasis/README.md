# Scenario OASIS Worker

Thin, isolated simulation-worker boundary for Lumenva Scenario Lab.

## Security boundary

This worker is **not** a source of business truth. It must never receive Supabase `service_role`, database credentials, tenant secrets or authority to mutate CRM state. The TypeScript adapter sends only a sanitized synthetic scenario payload. Lumenva/Postgres remains authoritative for scenario/run lifecycle and evidence.

The worker keeps ephemeral process memory only. Restarting the worker may lose local preparations/runs; callers must treat that as a retryable worker failure while retaining authoritative run state in Lumenva.

## Drivers

`SCENARIO_OASIS_DRIVER=disabled` is the default. Runs fail closed with `OASIS_RUNNER_NOT_CONFIGURED`.

`SCENARIO_OASIS_DRIVER=mock` enables a deterministic protocol smoke driver. It is for integration testing only and is not OASIS.

A live `camel-oasis` driver must be implemented and verified against the installed OASIS version before enabling `SCENARIO_OASIS_MODE=shadow|on` in Lumenva. This repository intentionally does not copy MiroFish implementation or prompts and does not guess unstable OASIS APIs.

## Local protocol smoke

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
SCENARIO_OASIS_DRIVER=mock uvicorn app:app --host 127.0.0.1 --port 8787
```

Endpoints:

- `GET /health`
- `POST /v1/prepare`
- `POST /v1/runs`
- `GET /v1/runs/{id}`
- `POST /v1/runs/{id}/cancel`
- `GET /v1/runs/{id}/artifacts`

No production deployment, secrets or live OASIS execution has been performed from this branch-only environment. Those gates remain PENDING until an executable environment validates them.
