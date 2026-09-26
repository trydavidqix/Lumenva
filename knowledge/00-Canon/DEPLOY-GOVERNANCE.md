# DEPLOY GOVERNANCE

## 1. Immutable Infrastructure
- Infrastructure is defined as code.
- Manual changes to production infrastructure are strictly prohibited.

## 2. Evidence-Based Promotion
- Code cannot be deployed without evidence of success (tests passed, types checked).
- Promotion to PROD requires P4 (Owner) approval and Maestro validation.

## 3. Rollbacks
- Every deployment must have an automated rollback plan.
- Failed deployments automatically trigger a rollback to the last known good state.
