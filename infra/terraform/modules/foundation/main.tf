terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# Enable required APIs
resource "google_project_service" "services" {
  for_each = toset([
    "logging.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "firebase.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtasks.googleapis.com",
    "redis.googleapis.com",
    "identitytoolkit.googleapis.com"
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# 1. Secret Manager
resource "google_secret_manager_secret" "example_secret" {
  secret_id = "example-secret-${var.environment}"
  project   = var.project_id
  replication {
    auto {}
  }
  depends_on = [google_project_service.services]
}

# 2. Cloud Storage
resource "google_storage_bucket" "main_bucket" {
  name          = "${var.project_id}-main-bucket-${var.environment}"
  location      = var.region
  force_destroy = var.environment != "prod"
  
  uniform_bucket_level_access = true
}

# 3. Cloud SQL (PostgreSQL)
resource "google_sql_database_instance" "main_db" {
  name             = "${var.project_id}-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier = var.environment == "prod" ? "db-custom-2-7680" : "db-f1-micro"
  }

  deletion_protection = var.environment == "prod"
  depends_on          = [google_project_service.services]
}

# 4. Cloud Run
resource "google_cloud_run_v2_service" "main_service" {
  name     = "main-service-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello" # Stub image
    }
  }

  depends_on = [google_project_service.services]
}

# 5. Firebase Hosting (Stub)
# In a real scenario, a Firebase project would be provisioned first.
resource "google_firebase_hosting_site" "main_site" {
  provider = google-beta
  project  = var.project_id
  site_id  = "${var.project_id}-site-${var.environment}"
  app_id   = var.firebase_app_id != "" ? var.firebase_app_id : null

  depends_on = [google_project_service.services]
}

# 5.b Firebase Auth (Identity Platform)
resource "google_identity_platform_config" "default" {
  project = var.project_id

  sign_in {
    allow_duplicate_emails = false
    
    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_project_service.services]
}

# 6. Cloud Tasks (Replaces Inngest)
resource "google_cloud_tasks_queue" "default_queue" {
  name     = "default-queue-${var.environment}"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_dispatches_per_second = 100
    max_concurrent_dispatches = 100
  }

  retry_config {
    max_attempts       = 5
    max_retry_duration = "43200s" # 12 hours
  }

  depends_on = [google_project_service.services]
}

# 7. Cloud Scheduler (Replaces Vercel Cron)
resource "google_cloud_scheduler_job" "default_scheduler" {
  name        = "default-scheduler-${var.environment}"
  description = "Default scheduler job"
  schedule    = "0 0 * * *" # Daily at midnight
  time_zone   = "UTC"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "https://example.com/api/cron" # Replace with actual webhook
    
    oidc_token {
      service_account_email = "default" # Should use a dedicated SA in a real setup
    }
  }

  depends_on = [google_project_service.services]
}

# 8. Memorystore / Redis (Replaces Upstash)
resource "google_redis_instance" "main_redis" {
  name           = "main-redis-${var.environment}"
  memory_size_gb = 1
  region         = var.region
  project        = var.project_id
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  
  redis_version  = "REDIS_6_X"

  depends_on = [google_project_service.services]
}

# 9. BigQuery Telemetry Dataset
resource "google_bigquery_dataset" "ai_telemetry" {
  dataset_id                  = "ai_telemetry_${var.environment}"
  friendly_name               = "AI Telemetry"
  description                 = "Dataset for AI routing and latency telemetry"
  location                    = var.region
  project                     = var.project_id

  depends_on = [google_project_service.services]
}

