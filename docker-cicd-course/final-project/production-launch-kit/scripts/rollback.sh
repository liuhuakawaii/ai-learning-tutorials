#!/usr/bin/env sh
set -eu

previous_image=${1:-}
if [ -z "$previous_image" ]; then
  echo "Usage: scripts/rollback.sh ghcr.io/your-org/production-launch-kit-api:<tag>"
  exit 1
fi

APP_IMAGE="$previous_image" docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api
docker compose ps
