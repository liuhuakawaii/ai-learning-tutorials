#!/bin/bash
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

echo "Starting backup at $TIMESTAMP..."

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "${DB_HOST:-postgres}" \
  -U "${DB_USER:-n8n}" \
  -d "${DB_NAME:-n8n}" \
  > "$BACKUP_PATH/n8n.sql"

# Backup n8n data volume
echo "Backing up n8n data..."
docker cp n8n:/home/node/.n8n "$BACKUP_PATH/n8n-data" 2>/dev/null || true

# Compress
echo "Compressing backup..."
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_PATH"

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_PATH.tar.gz"
