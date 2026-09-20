#!/bin/bash
set -e

# Deploy to Google Cloud Run
# Ensure to have variables set: PROJECT_ID, REGION, SERVICE_NAME, IMAGE_URL

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URL" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest"

echo "Deployment complete."
