module "foundation" {
  source = "../../modules/foundation"

  project_id      = "lumenva-dev-project"
  region          = "us-central1"
  environment     = "dev"
}
