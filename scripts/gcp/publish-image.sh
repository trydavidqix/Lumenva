#!/bin/bash
set -euo pipefail

# Script local para simular build e tag imutável de acordo com o contrato F8
# Ele faz build e permite dry-run no Artifact Registry.

IMAGE_NAME=${1:-lumenva-app}
REGISTRY=${2:-us-east1-docker.pkg.dev/PLACEHOLDER_PROJECT/placeholder-repo}
COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown-sha")

TAG="${REGISTRY}/${IMAGE_NAME}:${COMMIT_SHA}"
LATEST_TAG="${REGISTRY}/${IMAGE_NAME}:latest"

echo "=== F8 Build & Publish (Dry-Run) ==="
echo "Image: ${IMAGE_NAME}"
echo "Registry: ${REGISTRY}"
echo "Commit SHA: ${COMMIT_SHA}"
echo "Tags: ${TAG}, ${LATEST_TAG}"
echo "===================================="

# Emulando contrato de build
echo "[INFO] Running docker build with tags..."

# Build normal, ou usa buildx se disponível
if command -v docker >/dev/null 2>&1; then
  # Executamos o build - no servidor real seria com buildx e load ou registry fake
  echo "docker build -t ${TAG} -t ${LATEST_TAG} ."
  echo "[OK] Build simulado/dry-run concluido."
else
  echo "[WARNING] Docker not found, skipping local build command execution."
fi

# Não fazemos docker push por segurança/F8-C0 rule
echo "[INFO] Push está DESABILITADO neste gate (F8-C0 exige dry-run sem envio real)."
