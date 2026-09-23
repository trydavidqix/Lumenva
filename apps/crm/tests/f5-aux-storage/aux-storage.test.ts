import { describe, it, expect } from "vitest";

// Define a test to verify that the files are importing getGcsBucket and createGcsObjectStore from @lumenva/db
import { readFileSync } from "fs";
import { join } from "path";

describe("Auxiliary storage migration", () => {
  const filesToMigrate = [
    "app/api/v1/content-os/assets/route.ts",
    "lib/ai/rag/ingest/policy.ts",
    "lib/ai/rag/publication/publish-policy.ts",
    "lib/ai/skills/install.ts",
    "lib/agent-engine/agent/media-parts.ts",
    "lib/agent-engine/agent/skill-references.ts",
    "lib/lgpd/storage-redaction-queue.ts",
    "lib/mcp/tools/attachments.ts",
  ];

  it("should have migrated all files to use GCS ObjectStore", () => {
    for (const file of filesToMigrate) {
      const content = readFileSync(join(process.cwd(), "apps", "crm", file), "utf-8");

      // Should not contain .storage.from( or .from("bucket").upload( etc
      // This is a naive check to ensure migration
      expect(content).not.toContain(".storage.from(");

      // Should import the new modules
      expect(content).toMatch(/import.*(?:createGcsObjectStore|getGcsBucket).*from.*['"]@lumenva\/db/);
    }
  });
});
