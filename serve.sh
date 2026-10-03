#!/usr/bin/env bash
# Start the local nginx container that serves this static site.
set -euo pipefail

cd "$(dirname "$0")"

PORT="8080"
URL="http://localhost:${PORT}"

docker compose up -d

echo "Site disponível em ${URL}"
