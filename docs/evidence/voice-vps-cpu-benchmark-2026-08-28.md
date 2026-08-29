# Voice CPU benchmark — VPS de produção real (lumenva-crm)

Date: 2026-08-28

## Why this test exists

The earlier benchmark (`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`) ran on Google
Colab, which had `12.67 GiB` of RAM — more than 3x the real production VPS's total `3.7 GiB`.
The owner asked to test directly on the real VPS instead of extrapolating from Colab, since no
client traffic exists yet and the risk of a short, supervised test is low.

## Environment

- Real production VPS `lumenva-crm` (`root@2.29.8.225`), the same host that runs the DeskcommCRM
  production stack (Caddy + app + worker + WAHA + Redis + mem0 + graphiti + neo4j).
- CPU: `AMD EPYC-Genoa Processor`, 2 vCPU (`nproc` = 2).
- RAM: `3.7 GiB` total. `docker compose -f docker-compose.prod.yml stop` plus `docker stop` on
  the mem0/graphiti/neo4j containers freed the box to ~`1.9 GiB` available before the benchmark
  ran (all containers had been running normally beforehand; nothing was broken or misconfigured).
- OS: Ubuntu `26.04 LTS` (Resolute Raccoon). System Python: `3.14.4` — no `python3.12` package
  available via apt on this release, and no attempt was made to build one from source for this
  test.
- GPU: none.

## Explicit authorization and safety

- The repository owner explicitly authorized stopping the production containers for this test
  (chat authorization, 2026-08-28), after being warned this touches a real production host.
- No client has been onboarded yet — verified low-risk window for the test.
- Procedure: `docker compose -f docker-compose.prod.yml --env-file .env stop` (app/worker/
  scheduler/caddy/waha/redis/srh), then `docker stop` on `mem0`, `mem0-postgres`, `graphiti`,
  `neo4j` (not covered by the same compose invocation).
- Recovery: `docker start` on the mem0/graphiti/neo4j containers, then
  `docker compose -f docker-compose.prod.yml --env-file .env start` for the rest.
- Post-recovery verification: all 11 containers back to `Up ... (healthy)` (mem0 went from
  `unhealthy` before the test to `healthy` after the restart); `curl -s -o /dev/null -w
  "%{http_code}" https://crm.lumenva.pt/` returned `307`, matching the expected redirect-to-login
  documented in `docs/runbooks/deploy.md`.
- No production data was created, modified, or deleted. No `VOICE_LIVE_ENABLED` flag was touched.
  No SIP trunk, PSTN call, or client-facing surface was involved.

## What was tested

- `faster-whisper` (`tiny`, CPU, `int8`, `cpu_threads=2`) — same configuration as the Colab run.
- Piper (`pt_BR-cadu-medium`) — same voice model as the Colab run.
- **Kokoro — tested in a second pass (see "Kokoro — second pass" below).** The Python-version
  blocker described in the original version of this section (VPS system Python `3.14.4`,
  `kokoro==0.9.4` needs `<3.13`) was solved without touching the system Python: a disposable
  `python:3.12-slim` Docker container, removed automatically after the run (`docker run --rm`).

## Raw measurements

Text: a fixed ~14-second Portuguese sentence (longer than the Colab test's ~11s, not
deliberately controlled — Piper's natural output length for this sentence at this voice).

### Piper `pt_BR-cadu-medium`

| Run | Elapsed seconds | Audio seconds | Real-time factor |
|---|---:|---:|---:|
| 1 | 1.026614 | 13.943583 | 0.074 |
| 2 | 0.978559 | 14.094512 | 0.069 |
| 3 | 0.958205 | 13.862313 | 0.069 |

### faster-whisper `tiny`, CPU, `int8`, `cpu_threads=2`

Input: the Piper output from run 3 above (`13.862313 s`).

| Run | Elapsed seconds | Audio seconds | Real-time factor |
|---|---:|---:|---:|
| 1 | 1.055211 | 13.862313 | 0.076 |
| 2 | 1.009083 | 13.862313 | 0.073 |
| 3 | 1.032497 | 13.862313 | 0.074 |

Audio sanity check: output WAV verified non-silent (`RMS ≈ 0.107`, sample rate `22050 Hz`,
`305664` samples) — the fast numbers are not an artifact of empty/degenerate audio.

### Kokoro `pf_dora`, CPU — second pass, same session, same VPS

Ran inside `python:3.12-slim` (Docker, `--rm`), with the production containers stopped the same
way as the Piper/faster-whisper run above (this was a separate stop/start cycle within the same
2026-08-28 session — production was fully healthy again in between the two passes).

- Model load: `20.282088 s` (vs `6.503924 s` on Colab — container cold-start plus an
  unauthenticated Hugging Face Hub download likely account for most of the difference; this was
  not isolated from download time).
- Text: the same fixed Portuguese sentence used above, `12.825 s` of output audio per run.

| Run | Elapsed seconds | Audio seconds | Real-time factor |
|---|---:|---:|---:|
| 1 | 9.190072 | 12.825 | 0.717 |
| 2 | 6.815948 | 12.825 | 0.531 |
| 3 | 6.376497 | 12.825 | 0.497 |

## Result

- **Kokoro is real-time-viable on this VPS (RTF 0.50–0.72), reversing the Colab result (RTF
  ~2.0, twice slower than real time).** This is the opposite direction from what the Colab test
  predicted — on Colab Kokoro was the clear `FAIL`; on the real VPS it is now the closest of the
  three to a `PASS`/`marginal` split, though still the slowest of the three engines here. Model
  load (`20 s`) is a one-time cost that a persistent worker amortizes across many calls, not a
  per-call cost — but it was not isolated from container/download overhead, so treat it as an
  upper bound, not a clean measurement of Kokoro's own load time.

- **Both engines were dramatically faster on this real VPS than on Colab CPU**, despite the VPS
  having roughly a quarter of Colab's RAM. Piper: RTF ≈ `0.07` here vs `0.34–0.42` on Colab.
  faster-whisper: RTF ≈ `0.07–0.08` here vs `0.14–0.42` on Colab (varies by Colab run).
- Best explanation available: the VPS's `AMD EPYC-Genoa` vCPU is a modern, likely single-tenant
  or lightly-shared core with strong single-thread performance; Colab's shared/free-tier CPU
  allocation is understood to be more variable and often older-generation. This is inference from
  the hardware naming, not a controlled multi-host comparison — do not treat it as proven root
  cause.
- On this specific measurement, both `faster-whisper` and Piper are well inside a real-time
  interactive budget (elapsed time is a small fraction of audio duration) on the real production
  VPS's CPU alone, with the CRM stack fully stopped.
- **This reverses part of the earlier Colab-based caution against the current VPS** — all three
  engines (STT `faster-whisper`, TTS Piper, TTS Kokoro) are individually real-time-viable on this
  VPS's CPU, in isolation, sequentially, with the CRM stopped. It does **not** confirm the VPS is
  sufficient for production voice — see "Not tested" below for what remains unverified.

## Concurrent-load pass — all three engines at once, CRM running (2026-08-28, same session)

Owner explicitly asked to test whether the VPS "runs everything together." This pass ran
**`faster-whisper` + Piper (host venv, 3 runs each) and Kokoro (Docker container, 3 runs)
simultaneously in the background, with the full CRM stack up and healthy** (not stopped this
time) — the closest reproduction of real concurrent load achievable without the actual Asterisk/
Pipecat telephony path, which does not exist in this checkout yet.

### Results under concurrent load

| Engine | RTF range (concurrent) | RTF range (isolated, above) |
|---|---|---|
| Piper | `0.127–0.207` | `0.069–0.074` |
| faster-whisper | `0.144–0.242` | `0.073–0.076` |
| Kokoro | `0.590–0.860` | `0.497–0.717` |

All three stayed below `1.0` (real-time) even under concurrent load with the CRM running — 2–3x
slower than isolated, but no engine crossed into `FAIL` territory in this run.

### CRM behavior during the test

- `curl https://crm.lumenva.pt/` before the concurrent run: `307` in `0.63s`.
- Same check mid-run (peak load, `RAM available` at `728Mi`, swap at `2.3Gi` used): `307` in
  `1.70s` — noticeably slower, but still responding, not down.
- Same check right after the run finished (Kokoro container removed): `307` in `0.39s` — back to
  normal.
- All 11 `docker ps` containers stayed `Up`/`healthy` throughout; none crashed, restarted, or
  were OOM-killed.
- Peak swap usage during the test: `~2.3 GiB` of `4 GiB` configured swap. The box leaned on swap
  heavily, not just RAM — on a VPS without that much swap configured, this same test could behave
  worse (thrashing or OOM) than what was observed here.

### What this concurrent pass does NOT prove

- **This is not a real phone call.** No Asterisk, no RTP audio stream, no Pipecat runtime, no
  streaming/chunked processing — three independent batch jobs running in parallel is a proxy for
  "does the box choke under combined CPU/RAM pressure," not a rehearsal of the actual voice
  pipeline's resource profile.
- Only one concurrent "call" was simulated (each engine ran its own 3 sequential internal runs
  while the others ran too) — not multiple simultaneous customer calls.
- The CRM was idle (no real user traffic) during the test; a live tenant hitting the CRM at the
  same time as this load was not simulated.
- Swap usage this high, sustained over a real multi-minute call (not a ~15s batch job), could
  degrade differently — this test's total wall-clock was well under a minute per engine.

## Not tested (remaining real gaps, not silent claims of success)

- **Asterisk RTP/media bridge, Pipecat runtime, or any SIP/PSTN path** — still not exercised.
  This and the concurrent-load pass above are engine-viability/load-proxy tests, isolated from
  the actual telephony stack.
- **Streaming/partial-result latency** — both passes measured whole-utterance batch processing
  (full ~14s audio in, full transcript/audio out), not the chunked/streaming behavior a live call
  needs for low perceived latency.
- **Sustained/repeated calls** — only 3 runs per engine, back-to-back, no soak test (longest
  single run observed: ~15s wall-clock per engine, not minutes).
- **Multiple simultaneous calls** — the concurrent pass ran one instance of each engine type at
  once, not N customers calling at the same time.
- **Asterisk itself running at the same time** — the concurrent pass did not include an Asterisk
  process; only the CRM stack + the three ML engines. Adding Asterisk/Pipecat would add further
  CPU/RAM pressure not captured here.

## Validation method

- `apt-get install python3.14-venv espeak-ng`, then `python3 -m venv venv` inside
  `/opt/voice-vps-bench` on the VPS (not inside any Docker container, not part of the repo).
- `pip install faster-whisper piper-tts soundfile` inside that venv.
- Piper voice downloaded with `python -m piper.download_voices --data-dir ./piper-voices
  pt_BR-cadu-medium`.
- Timing script: Piper synthesizes a fixed sentence 3 times via `PiperVoice.synthesize(...)`,
  writing 16-bit PCM WAV via `soundfile`; `faster-whisper` (`WhisperModel('tiny', device='cpu',
  compute_type='int8', cpu_threads=2)`) transcribes the resulting WAV 3 times, materializing all
  segments (`list(segments)`) before stopping the timer — same method as the Colab test.
- Real-time factor = `elapsed_seconds / audio_duration_seconds`.
- Kokoro run separately, inside `docker run --rm -v /opt/voice-vps-bench:/work -w /work
  python:3.12-slim ...`: `apt-get install espeak-ng`, `pip install kokoro==0.9.4 soundfile`,
  then `KPipeline(lang_code='p', device='cpu')` + `pipeline(text, voice='pf_dora')`,
  materializing and concatenating all yielded audio chunks before stopping the timer — same
  method as the Colab test. The container was removed automatically on exit (`--rm`); nothing
  Kokoro-related was left installed on the VPS itself.
- Test artifacts left at `/opt/voice-vps-bench/` on the VPS (venv + downloaded Piper voice, a
  few hundred MB) for reuse by a future session; not part of the Git repository, no secrets in
  it. `/tmp/piper_out.wav` is a transient test file.

## Relation to the Colab test

Read alongside `docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`. This VPS test now covers
all three engines the Colab test covered, on the real production hardware instead of a borrowed
sandbox — and flips Kokoro's verdict from `FAIL` to real-time-viable. It still does not cover
load/streaming conditions — see "Not tested" above.
