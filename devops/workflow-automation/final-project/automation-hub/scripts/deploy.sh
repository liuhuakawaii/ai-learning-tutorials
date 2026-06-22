#!/bin/bash
set -e

echo "Deploying n8n Automation Hub..."

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo "Error: docker is not installed"
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  echo "Error: docker compose is not available"
  exit 1
fi

# Check .env file
if [ ! -f .env ]; then
  echo "Error: .env file not found. Copy .env.example to .env and configure it."
  exit 1
fi

# Source .env
export $(cat .env | grep -v '^#' | xargs)

# Validate required variables
required_vars="N8N_HOST N8N_USER N8N_PASSWORD N8N_ENCRYPTION_KEY DB_PASSWORD"
for var in $required_vars; do
  if [ -z "${!var}" ] || [ "${!var}" = "changeme-"* ]; then
    echo "Error: $var is not configured or still has default value"
    exit 1
  fi
done

# Backup before deploy
if [ -f scripts/backup.sh ]; then
  echo "Creating backup before deploy..."
  bash scripts/backup.sh || echo "Backup failed, continuing deploy..."
fi

# Pull latest images
echo "Pulling images..."
docker compose pull

# Deploy
echo "Starting services..."
docker compose up -d

# Wait for health
echo "Waiting for services to be healthy..."
sleep 10

# Check health
if docker compose ps | grep -q "unhealthy"; then
  echo "Warning: Some services are unhealthy"
  docker compose ps
else
  echo "All services are healthy"
fi

echo "Deploy complete!"
echo "Access n8n at: https://$N8N_HOST"
