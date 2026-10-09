# Store Adapter (Task 12)

This document describes the read-only catalog and orders adapter implementation for dropshipping as specified in Task 12 of the Lumenva unification plan.

## Overview

The `DropshippingStoreAdapter` acts as a read-only bridge between Lumenva and an external store provider (currently Nuvemshop). It enforces the following requirements:
- **Read-Only**: The adapter only supports fetching paginated products and orders. No mutation (GraphQL or REST), catalog changes, or order manipulations are implemented here.
- **Tenant & Store Validation**: It compares the `expectedStoreId` provided during instantiation against the active store context from the provider API. If there is a mismatch, it returns a `BLOCKED` status without leaking data.
- **Error Handling**: Missing permissions or authentication failures (401, 403) correctly map to `EXTERNAL_VALIDATION_PENDING` without causing a generic crash. Rate limits (429) result in `RATE_LIMITED`.
- **Snapshot Support**: Results are structured into snapshots containing properties like `isPartial` (for pagination), `stale`, and `fetchedAt`, preserving evidence and preventing missing page errors.
- **No Mocks in Production**: Testing relies solely on synthetic fixtures without triggering external calls.

## Usage

```typescript
import { NuvemshopApiClient } from "../../nuvemshop/api-client";
import { DropshippingStoreAdapter } from "./adapter";

const apiClient = new NuvemshopApiClient({ storeId: "...", accessToken: "..." });
const storeAdapter = new DropshippingStoreAdapter(apiClient, "expected-store-id");

// Fetch products paginated
const products = await storeAdapter.getProducts(1, 50);

// Fetch orders paginated
const orders = await storeAdapter.getOrders(1, 50);
```

By ensuring operations are read-only and credentials do not leak into UI state, the adapter maintains the system's security posture and fulfills the objective.
