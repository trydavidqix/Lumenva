#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${VOICE_LOCAL_SPEECH_URL:-http://127.0.0.1:8000}"
STT_MODEL="${VOICE_LOCAL_STT_MODEL:-}"
TTS_PRIMARY_MODEL="${VOICE_LOCAL_TTS_PRIMARY_MODEL:-speaches-ai/Kokoro-82M-v1.0-ONNX}"
TTS_FALLBACK_MODEL="${VOICE_LOCAL_TTS_FALLBACK_MODEL:-}"

if [[ -z "${STT_MODEL}" ]]; then
  echo "VOICE_LOCAL_STT_MODEL is required" >&2
  exit 2
fi

wait_for_server() {
  for _ in $(seq 1 60); do
    if curl --fail --silent --show-error "${BASE_URL}/v1/models" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Speaches did not become ready at ${BASE_URL}" >&2
  exit 1
}

pull_model() {
  local model="$1"
  [[ -n "${model}" ]] || return 0
  echo "Ensuring local speech model: ${model}"
  curl --fail --silent --show-error --request POST \
    "${BASE_URL}/v1/models/${model}" >/dev/null
}

wait_for_server
pull_model "${STT_MODEL}"
pull_model "${TTS_PRIMARY_MODEL}"
pull_model "${TTS_FALLBACK_MODEL}"

echo "Local speech models are ready."
