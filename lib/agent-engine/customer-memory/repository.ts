import { CustomerQuickMemorySchema, type CustomerQuickMemory } from "./types";

type DbResult<T> = Promise<{ data?: T | null; error?: { message: string } | null }>;

type CustomerMemoryQuery = {
  select(columns: string): CustomerMemoryQuery;
  eq(column: string, value: string): CustomerMemoryQuery;
  maybeSingle(): DbResult<Record<string, unknown>>;
  upsert(
    payload: Record<string, unknown>,
    options: { onConflict: string },
  ): DbResult<unknown>;
  delete(): CustomerMemoryQuery;
};

export interface CustomerMemoryDbClient {
  from(table: "customer_memory"): CustomerMemoryQuery;
}

export interface CustomerMemoryRepository {
  getQuickMemory(organizationId: string, contactId: string): Promise<CustomerQuickMemory | null>;
  upsertQuickMemory(memory: CustomerQuickMemory): Promise<void>;
  deleteQuickMemory(organizationId: string, contactId: string): Promise<void>;
}

function dbError(operation: string, error: { message: string } | null | undefined): Error {
  return new Error(`[customer-memory] ${operation} failed: ${error?.message ?? "unknown database error"}`);
}

export function createCustomerMemoryRepository(
  client: CustomerMemoryDbClient,
): CustomerMemoryRepository {
  return {
    async getQuickMemory(organizationId, contactId) {
      const result = await client
        .from("customer_memory")
        .select("memory")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .maybeSingle();

      if (result.error) throw dbError("read", result.error);
      if (!result.data) return null;

      const stored = result.data.memory;
      if (stored === null || stored === undefined) return null;
      return CustomerQuickMemorySchema.parse(stored);
    },

    async upsertQuickMemory(memory) {
      const parsed = CustomerQuickMemorySchema.parse(memory);
      const result = await client.from("customer_memory").upsert(
        {
          organization_id: parsed.organizationId,
          contact_id: parsed.contactId,
          memory: parsed,
          updated_at: parsed.updatedAt,
        },
        { onConflict: "organization_id,contact_id" },
      );

      if (result.error) throw dbError("upsert", result.error);
    },

    async deleteQuickMemory(organizationId, contactId) {
      const result = await client
        .from("customer_memory")
        .delete()
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId);

      if ((result as { error?: { message: string } | null }).error) {
        throw dbError("delete", (result as { error?: { message: string } | null }).error);
      }
    },
  };
}
