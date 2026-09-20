variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The primary region for resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "The environment name (dev, staging, prod)"
  type        = string
}

variable "firebase_app_id" {
  description = "The Firebase App ID (stub)"
  type        = string
  default     = ""
}
