import { describe, expect, it } from "vitest";
import { buildLeadCustomFieldsSchema } from "./build-schema";
import { pipelineFieldsSchema } from "./schema";

describe("custom fields contract", () => {
  const fields = pipelineFieldsSchema.parse([
    { key: "size", label: "Size", type: "select", options: ["S", "M", "L"], required: true },
    { key: "budget", label: "Budget", type: "currency" },
    { key: "legacy", label: "Legacy", type: "text", deprecated: true },
  ]);

  it("accepts declared values and excludes deprecated fields", () => {
    const schema = buildLeadCustomFieldsSchema(fields);
    expect(schema.safeParse({ size: "M", budget: 9950, legacy: "old" }).success).toBe(false);
    expect(schema.parse({ size: "M", budget: 9950 })).toEqual({ size: "M", budget: 9950 });
  });

  it("rejects unknown keys, invalid options, and missing required values", () => {
    const schema = buildLeadCustomFieldsSchema(fields);
    expect(schema.safeParse({ size: "XL" }).success).toBe(false);
    expect(schema.safeParse({ size: "M", extra: true }).success).toBe(false);
    expect(schema.safeParse({ budget: 10 }).success).toBe(false);
  });

  it("validates numeric ranges and multi-value limits", () => {
    const parsed = pipelineFieldsSchema.parse([
      { key: "score", label: "Score", type: "number", min: 1, max: 5 },
      { key: "tags", label: "Tags", type: "multiselect", options: ["a", "b"] },
    ]);
    const schema = buildLeadCustomFieldsSchema(parsed);
    expect(schema.safeParse({ score: 6, tags: ["a"] }).success).toBe(false);
    expect(schema.safeParse({ score: 3, tags: ["a", "b", "a"] }).success).toBe(false);
  });
});
