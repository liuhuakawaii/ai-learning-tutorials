#!/bin/bash
set -e

echo "Running health checks..."

# Check n8n
echo -n "n8n: "
if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

# Check PostgreSQL
echo -n "PostgreSQL: "
if docker compose exec -T postgres pg_isready -U n8n > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

# Check Redis
echo -n "Redis: "
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

# Check Workers
echo -n "Workers: "
WORKER_COUNT=$(docker compose ps n8n-worker --format json 2>/dev/null | grep -c "running" || echo "0")
if [ "$WORKER_COUNT" -gt 0 ]; then
  echo "OK ($WORKER_COUNT running)"
else
  echo "WARNING: No workers running"
fi

echo ""
echo "Health check complete."
