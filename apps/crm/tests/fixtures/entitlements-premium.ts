/** Deterministic Premium fixtures; identifiers are test-only and contain no secrets. */
export const PREMIUM_PLAN_SLUG = "premium" as const;
export const PREMIUM_TEST_TENANTS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
] as const;
export const PREMIUM_MODULE_SLUGS = ["contacts", "agents", "jobs", "audit"] as const;
