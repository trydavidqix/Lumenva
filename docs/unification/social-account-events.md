# Social Account Events - Task 07 Status: BLOCKED

## Summary
Task 07 execution was halted because it is impossible to securely implement the Meta webhook integration within the strict allowlist constraints, given the current contracts.

## Evidence & Blockers

1. **Tenant Lookup Limitation**:
   The incoming Meta webhook payload (`x-hub-signature-256`, body) does not include a `workspaceId` (tenant ID). To securely map the incoming event's `accountExternalId` to an internal account and deduplicate, we need to query accounts globally by `externalAccountId`. However, the existing `SocialAccountService` contract (which we are not permitted to alter or bypass):
   ```ts
   export type SocialAccountService = {
     syncSocialAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
     listSocialAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
   }
   ```
   Strictly requires a `workspaceId` up front to list accounts. There is no `findAccountByExternalId(externalId)` method. Without modifying this service or its repository (which falls outside the safe allowlist if we must alter `types.ts` or persistence), we cannot resolve the tenant from the payload.

2. **Dependency Injection & Routing**:
   The `apps/social-web/app/api/webhooks/meta/route.ts` route handler needs access to the domain ingester (which in turn requires the `SocialAccountService`). Since we are forbidden from modifying `packages/core/social-brain/core/src/index.ts` or any global DI containers, any attempt to instantiate or wire up the service within the route handler would necessitate introducing mock dependencies or unsafe global singletons directly into production routing code, violating secure architecture practices.

## Conclusion
To proceed securely, the following architectural adjustments are required (requiring Owner review):
- Extending `SocialAccountService` (and its backing repository) to support lookup by `externalAccountId` across all workspaces.
- Providing a mechanism in the DI container (or `index.ts` exports) to safely inject the event ingester and account service into Next.js Edge/Serverless routes without hardcoding.
