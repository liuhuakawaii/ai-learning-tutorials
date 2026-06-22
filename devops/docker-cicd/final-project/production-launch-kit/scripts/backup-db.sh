#!/usr/bin/env sh
set -eu

mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U app app > "backups/app-$stamp.sql"
echo "Backup written to backups/app-$stamp.sql"
