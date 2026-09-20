module "foundation" {
  source = "../../modules/foundation"

  project_id      = "lumenva-staging-project"
  region          = "us-central1"
  environment     = "staging"
}
