# SECURITY

## 1. Zero Trust Architecture
- Never trust, always verify.
- Internal networks are treated as hostile.
- Every request must be authenticated and authorized.

## 2. Data Protection
- Encryption at rest and in transit.
- Secrets are managed exclusively via centralized Secret Managers (e.g., GCP Secret Manager).
- No secrets in code, logs, or agent memory.

## 3. Incident Response
- All infrastructure mutations are logged.
- Security anomalies trigger immediate isolation of the affected tenant/component.
