#!/usr/bin/env sh
set -eu

echo "Pulling images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

echo "Starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "Checking health..."
docker compose ps
