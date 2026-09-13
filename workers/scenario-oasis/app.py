from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Lumenva Scenario OASIS Worker", version="0.1.0")

RunStatus = Literal["PENDING", "PREPARING", "RUNNING", "COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT"]


class PrepareRequest(BaseModel):
    protocolVersion: Literal["lumenva-scenario-oasis@1"]
    scenario: dict[str, Any]
    strategy: dict[str, Any]
    population: dict[str, Any]
    seed: int
    rounds: int = Field(ge=1, le=100)


class RunRequest(BaseModel):
    protocolVersion: Literal["lumenva-scenario-oasis@1"]
    runId: str
    scenarioId: str
    preparationId: str
    budget: dict[str, Any]


@dataclass
class Preparation:
    payload: dict[str, Any]
    payload_hash: str


@dataclass
class RunState:
    request: RunRequest
    status: RunStatus = "PENDING"
    error: str | None = None
    artifacts: dict[str, Any] | None = None
    cancel: threading.Event = field(default_factory=threading.Event)


PREPARATIONS: dict[str, Preparation] = {}
RUNS: dict[str, RunState] = {}
LOCK = threading.Lock()
DRIVER = os.getenv("SCENARIO_OASIS_DRIVER", "disabled").strip().lower()


def stable_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_synthetic_payload(payload: dict[str, Any]) -> None:
    population = payload.get("population") or {}
    actors = population.get("actors") or []
    if not actors:
        raise HTTPException(status_code=422, detail="population must contain synthetic actors")
    for actor in actors:
        if actor.get("synthetic") is not True:
            raise HTTPException(status_code=422, detail="every worker actor must be synthetic")
    forbidden = {"organizationId", "service_role", "databaseUrl", "apiKey", "accessToken"}
    serialized = json.dumps(payload)
    for key in forbidden:
        if f'"{key}"' in serialized:
            raise HTTPException(status_code=422, detail=f"forbidden worker field: {key}")


def deterministic_mock(preparation: Preparation, state: RunState) -> dict[str, Any]:
    payload = preparation.payload
    seed = int(payload["seed"])
    rounds = int(payload["rounds"])
    strategy = payload.get("strategy") or {}
    params = strategy.get("parameters") or {}
    numeric = [float(v) for v in params.values() if isinstance(v, (int, float)) and not isinstance(v, bool)]
    signal = sum(numeric) / len(numeric) if numeric else 0.0
    jitter = ((seed % 997) / 997.0 - 0.5) * 0.1
    value = round(signal + jitter, 6)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "provenance": {
            "synthetic": True,
            "scenarioId": state.request.scenarioId,
            "runId": state.request.runId,
            "seed": seed,
            "engineVersion": "camel-oasis",
            "evidenceRefs": [entry.get("id") for entry in (payload.get("scenario", {}).get("evidenceRefs") or []) if entry.get("id")],
            "createdAt": now,
        },
        "events": [{"kind": "worker.mock.completed", "occurredAt": now, "payload": {"rounds": rounds}}],
        "outcomes": [{"key": "worker_strategy_signal", "value": value}],
        "metrics": {"worker_strategy_signal": value},
        "rawArtifactRefs": [],
    }


def run_job(external_id: str) -> None:
    with LOCK:
        state = RUNS.get(external_id)
        if state is None:
            return
        state.status = "RUNNING"
        preparation = PREPARATIONS.get(state.request.preparationId)
    if preparation is None:
        with LOCK:
            state.status = "FAILED"
            state.error = "preparation_not_found"
        return
    if state.cancel.is_set():
        with LOCK:
            state.status = "CANCELLED"
        return

    try:
        if DRIVER == "mock":
            artifacts = deterministic_mock(preparation, state)
        elif DRIVER == "disabled":
            raise RuntimeError("OASIS_RUNNER_NOT_CONFIGURED")
        else:
            # This boundary intentionally does not guess or vendor MiroFish/OASIS internals.
            # A verified camel-oasis integration must be supplied as a dedicated driver.
            raise RuntimeError(f"unsupported_oasis_driver:{DRIVER}")
        with LOCK:
            if state.cancel.is_set():
                state.status = "CANCELLED"
            else:
                state.artifacts = artifacts
                state.status = "COMPLETED"
    except Exception as exc:  # worker errors are artifacts, never CRM truth
        with LOCK:
            state.status = "FAILED"
            state.error = str(exc)[:500]


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "driver": DRIVER, "business_state": "ephemeral"}


@app.post("/v1/prepare")
def prepare(request: PrepareRequest) -> dict[str, Any]:
    payload = request.model_dump()
    validate_synthetic_payload(payload)
    preparation_id = str(uuid.uuid4())
    payload_hash = stable_hash(payload)
    with LOCK:
        PREPARATIONS[preparation_id] = Preparation(payload=payload, payload_hash=payload_hash)
    return {
        "preparationId": preparation_id,
        "engine": "oasis",
        "engineVersion": "camel-oasis",
        "sanitizedPayloadHash": payload_hash,
    }


@app.post("/v1/runs")
def create_run(request: RunRequest) -> dict[str, Any]:
    with LOCK:
        if request.preparationId not in PREPARATIONS:
            raise HTTPException(status_code=404, detail="preparation_not_found")
        external_id = str(uuid.uuid4())
        RUNS[external_id] = RunState(request=request)
    thread = threading.Thread(target=run_job, args=(external_id,), daemon=True)
    thread.start()
    return {"runId": external_id, "status": "PENDING"}


@app.get("/v1/runs/{external_id}")
def get_run(external_id: str) -> dict[str, Any]:
    with LOCK:
        state = RUNS.get(external_id)
        if state is None:
            raise HTTPException(status_code=404, detail="run_not_found")
        return {"status": state.status, "error": state.error}


@app.post("/v1/runs/{external_id}/cancel")
def cancel_run(external_id: str) -> dict[str, Any]:
    with LOCK:
        state = RUNS.get(external_id)
        if state is None:
            raise HTTPException(status_code=404, detail="run_not_found")
        state.cancel.set()
        if state.status in {"PENDING", "PREPARING", "RUNNING"}:
            state.status = "CANCELLED"
        return {"status": state.status}


@app.get("/v1/runs/{external_id}/artifacts")
def artifacts(external_id: str) -> dict[str, Any]:
    with LOCK:
        state = RUNS.get(external_id)
        if state is None:
            raise HTTPException(status_code=404, detail="run_not_found")
        if state.status != "COMPLETED" or state.artifacts is None:
            raise HTTPException(status_code=409, detail={"status": state.status, "error": state.error})
        return state.artifacts
