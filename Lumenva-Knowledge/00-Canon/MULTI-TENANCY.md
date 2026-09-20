# MULTI-TENANCY

## 1. Strict Isolation
- Tenants share infrastructure, but never data.
- Tenant boundaries are enforced at the database row level (Row Level Security) and application logic level.

## 2. No Cross-Pollination
- Agent memory and context are strictly scoped to a single tenant.
- A request from Tenant A can never access or infer data from Tenant B.

## 3. Performance Isolation
- Noisy neighbor mitigation is mandatory.
- Resource limits and quotas are enforced per tenant.
