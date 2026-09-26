# Wave 3: Peripherals to Google

This document outlines the transition of peripheral services to Google Cloud infrastructure as part of **Wave 3** of the Lumenva Mega Blueprint.

## 1. Context and Goals

To unify our infrastructure within Google Cloud (GCP) and minimize vendor sprawl, we are replacing several third-party services with native GCP alternatives. This brings our architecture closer to the definitive target state and enhances security, networking integration, and cost visibility.

## 2. Infrastructure Changes

The following replacements have been made in the Terraform foundation modules (`infra/terraform/modules/foundation/main.tf`):

- **Inngest -> Google Cloud Tasks**: We have provisioned a default Cloud Tasks queue with configured rate limits and retry logic. Cloud Tasks will act as the asynchronous task dispatcher for background jobs, replacing Inngest.
- **Vercel Cron -> Google Cloud Scheduler**: For recurring jobs and daily routines, we have introduced Cloud Scheduler. A daily midnight trigger has been mapped out to demonstrate the configuration.
- **Upstash (Redis) -> Google Cloud Memorystore**: A native Memorystore Redis instance is provisioned to serve as the high-performance caching layer and message broker where needed, replacing Upstash serverless Redis.

Required APIs (such as `cloudscheduler.googleapis.com`, `cloudtasks.googleapis.com`, and `redis.googleapis.com`) have been enabled in the project via Terraform.

## 3. Application Adapters

Structural interfaces and adapters have been created within the core backend to prepare for application-level integration:

- **Cloud Tasks Adapter**: Located in `packages/core/social-brain/core/src/cloud-tasks.ts`. It provides an `enqueueTask` method serving as a drop-in abstraction over the `@google-cloud/tasks` SDK. This replaces the previous Inngest client logic.
- **Memorystore Adapter**: Located in `packages/core/social-brain/core/src/memorystore.ts`. It offers standard `set`, `get`, and `delete` caching primitives. It abstracts the underlying Redis client (e.g. `ioredis`), replacing Upstash logic.

## 4. Next Steps

- Integrate `@google-cloud/tasks` and `ioredis` into the application dependencies.
- Implement the actual HTTP handlers on Cloud Run to receive Cloud Tasks and Cloud Scheduler dispatches.
- Refactor existing worker logic to bind to the new structural adapters.
- Validate network peering between the VPC and the Memorystore instance to allow the backend to connect seamlessly to Redis.
