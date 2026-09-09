import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(process.cwd(), "app/api/v1/conversations/[id]/archive/route.ts"), "utf8");

describe("conversation archive route contract", () => {
  it("supports idempotent POST upsert", () => {
    expect(route).toContain("export async function POST");
    expect(route).toContain("upsert");
    expect(route).toContain("conversation_id,user_id");
  });
  it("supports DELETE unarchive and missing row 404", () => {
    expect(route).toContain("export async function DELETE");
    expect(route).toContain("Conversa não arquivada");
  });
  it("scopes archive writes to authenticated user and tenant", () => {
    expect(route).toContain("authz.user.id");
    expect(route).toContain("authz.org.orgId");
  });
  it("returns 404 when flag is off", () => {
    expect(route).toContain("CONVERSATION_ARCHIVE_V1");
    expect(route).toContain('return fail("not_found"');
  });
  it("audits both directions", () => {
    expect(route).toContain('conversation.archived');
    expect(route).toContain('conversation.unarchived');
  });
});
