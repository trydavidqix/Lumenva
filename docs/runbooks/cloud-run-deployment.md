# Cloud Run Deployment and Rollback Strategy

## Overview

We are migrating our Next.js applications (`site`, `crm`, `social-brain-web`) from Vercel to Google Cloud Run as part of the Mega Blueprint. The database connections will continue pointing to Supabase via environment variables.

## Deployment Steps

Deploying any of our apps to Cloud Run involves building the Next.js standalone container using our root `Dockerfile` and deploying to Cloud Run via the `gcloud` CLI.

```bash
# Example for deploying the CRM app
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_APP_NAME=crm
```

You can also use standard Docker commands:
```bash
docker build --build-arg APP_NAME=crm -t lumenva-crm .
docker tag lumenva-crm gcr.io/YOUR_PROJECT_ID/lumenva-crm
docker push gcr.io/YOUR_PROJECT_ID/lumenva-crm

gcloud run deploy lumenva-crm \
  --image gcr.io/YOUR_PROJECT_ID/lumenva-crm \
  --platform managed \
  --port 8080
```

## Rollback Strategy (Vercel)

If Cloud Run fails, exhibits performance degradation, or faces unexpected configuration issues, we will perform a rollback to Vercel.

### Prerequisites

1. Do not remove the projects from Vercel until the Cloud Run migration is completely stable (at least 2 weeks of production traffic).
2. The databases (Supabase) remain untouched, minimizing data inconsistency risks during rollbacks.

### Rollback Execution

1. **DNS Cutover Reversal:** 
   Point the domains (e.g., `crm.lumenva.com`) back to Vercel's CNAME (`cname.vercel-dns.com` or `alias.zeit.co`) via your DNS provider.

2. **Trigger Vercel Redeployment (Optional):**
   If the Vercel deployment is stale, trigger a manual redeployment from the Vercel Dashboard for the target app.

3. **Verify Environment Variables:**
   Ensure that the Vercel project's environment variables (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, etc.) are up-to-date and match production credentials.

4. **Monitoring:**
   Verify the health of the application and monitor logs in Vercel to ensure traffic is correctly served.

### Post-Mortem

If a rollback is executed, open an incident in the tracking system. Document the failure modes of Cloud Run to unblock the migration at a later stage.
