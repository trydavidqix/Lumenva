# GCP Foundation Infrastructure

## 1. Environments

The infrastructure is designed with three distinct environments to ensure safe, scalable, and isolated deployments:

*   **DEV (`dev`)**: 
    *   **Purpose**: Development, testing, and sandbox environment.
    *   **Cost & Performance**: Uses minimal resources (e.g., `db-f1-micro` for Cloud SQL).
    *   **Destructibility**: Resources can be easily destroyed (e.g., Cloud Storage buckets force destroy is enabled).
    *   **Access**: Open to developers.
*   **STAGING (`staging`)**: 
    *   **Purpose**: Pre-production environment for final QA and integration testing. Matches production architecture as closely as possible.
    *   **Cost & Performance**: Mid-tier resources.
    *   **Access**: Restricted to QA, DevOps, and automated CI/CD pipelines.
*   **PROD (`prod`)**: 
    *   **Purpose**: Live production environment for end-users.
    *   **Cost & Performance**: Highly available and scaled resources (e.g., `db-custom-2-7680` for Cloud SQL).
    *   **Safety**: Deletion protection is enabled for databases. Cloud Storage buckets cannot be force-destroyed.
    *   **Access**: Strictly restricted to owners (P4) and automated deployment pipelines. Direct mutations are blocked.

## 2. Services Provisioned

The Terraform foundation module provisions the following core services:

*   **Cloud Run**: For dynamic workloads and APIs.
*   **Cloud SQL (PostgreSQL)**: For relational data persistence.
*   **Cloud Storage**: For object storage (assets, backups, etc.).
*   **Secret Manager**: For secure storage of sensitive keys and credentials.
*   **Firebase Hosting**: For static asset delivery and frontend hosting.
*   **Cloud Logging**: Centralized logging enabled at the project level for all resources.

## 3. Virtual Private Cloud (VPC) & Networking

*Currently, the foundation relies on the default VPC network for the initial scaffolding.*
Future iterations will define a custom VPC with:
*   **Private Services Access**: For secure internal communication to Cloud SQL without public IPs.
*   **Serverless VPC Access**: Allowing Cloud Run to access internal VPC resources.
*   **Cloud NAT & Router**: For outgoing internet access from private subnets.

## 4. Permissions & Security

*   **Principle of Least Privilege**: IAM roles should be granular. Service accounts used by Cloud Run should only have access to specific buckets and secrets.
*   **Infrastructure Mutaions**: As per `GEMINI.md`, infrastructure changes in PROD require P4 (OWNER) approval. Operations in PROD should ideally be handled via automated CI/CD with Terraform. DEV/STAGING can be modified for testing.
*   **Observability**: All resource logs are implicitly collected via Cloud Logging, enabling audits and monitoring.
