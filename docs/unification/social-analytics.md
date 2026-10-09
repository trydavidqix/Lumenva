# Social Analytics Mapping

## Content OS & Analytics Mapping
- **CRM Content OS**: Handles creation, draft, approval, and scheduling. CRM continues to be the product entry point.
- **Social Brain Analytics**: Focuses strictly on insights, time slots, performance, and historical data retrieval. Consolidates one calendar, one source per metric, and one job per routine.

## Pipeline & References
- Adapt daily content/reference pipeline from the origin into drafts with sources and hashes.
- Features like authenticated scraping and image generation are optional capabilities that require credentials and consent outside of the development phase.

## Metrics Constraints
- Stale metrics, insufficient sample size, assets lacking provenance, or unavailable providers result in explicitly "unavailable" or "inconclusive" states. They never become facts or recommendations.
- Cross-tenant or cross-organization data mixing is strictly prohibited. Identifiers must reconcile correctly by `provider`, `account`, and `post` without inventing missing data.
- Only adopt source deltas after license/rights and behaviors are confirmed.
- Unconnected UI data must be explicitly separated from fixtures/demos.
- No unauthenticated scraping, live API analytics, OAuth flows, or paid calls in dev/test phases.
- Approval remains a manual state.

## Fixtures & Test States
- Ensure valid series, empty series, delayed, and unavailable provider fixtures.
