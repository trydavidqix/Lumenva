import { z } from "zod";

/**
 * Validates and returns a deterministic, tenant-isolated graph namespace identifier.
 *
 * The namespace ensures that graph entities (nodes/edges) are isolated per tenant
 * within FalkorDB. It accepts organizationId (a valid UUID) and returns a namespace
 * string that the graph adapter uses internally to scope all subsequent queries.
 *
 * Doctrine bindings:
 * - organizationId must be a valid UUID; malformed UUIDs are rejected.
 * - No human-readable names, emails, phone numbers, or other PII are embedded.
 * - The same organizationId always produces the same namespace (deterministic).
 * - Different organizations always produce different namespaces (no collisions).
 * - Namespace is opaque to callers; graph adapter alone interprets it.
 *
 * @param organizationId - A valid UUID representing the tenant organization.
 * @returns A deterministic namespace string scoped to the organization.
 * @throws {ZodError} If organizationId is not a valid UUID.
 */
export function graphGroupId(organizationId: string): string {
  // Validate that organizationId is a proper UUID.
  // This rejects malformed UUIDs early before graph operations.
  const uuidSchema = z.string().uuid();
  const validated = uuidSchema.parse(organizationId);

  // Return deterministic namespace: org:<uuid>
  // This format is:
  // - Stable: same input always produces same output.
  // - Opaque: no leakage of human/PII data.
  // - Scoped: the "org:" prefix signals tenant-level isolation to graph consumers.
  return `org:${validated}`;
}
