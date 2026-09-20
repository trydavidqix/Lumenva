#!/bin/bash
set -e

# Applies Supabase migrations
echo "Applying database migrations..."

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

# Apply migrations using Supabase CLI
npx supabase db push --db-url "$DATABASE_URL"

echo "Migrations applied."
