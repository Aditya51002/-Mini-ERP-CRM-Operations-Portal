#!/bin/sh
set -e

echo "Running Prisma migrations..."

attempt=1
max_attempts="${PRISMA_MIGRATE_MAX_ATTEMPTS:-30}"

until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Prisma migrations failed after $attempt attempts."
    exit 1
  fi

  echo "Database is not ready for migrations yet. Retrying in 3 seconds... ($attempt/$max_attempts)"
  attempt=$((attempt + 1))
  sleep 3
done

echo "Starting backend..."
exec "$@"
