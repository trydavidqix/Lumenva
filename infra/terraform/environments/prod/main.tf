module "foundation" {
  source = "../../modules/foundation"

  project_id      = "lumenva-prod-project"
  region          = "us-central1"
  environment     = "prod"
}
