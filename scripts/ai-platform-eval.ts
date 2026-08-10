import { readFileSync } from "node:fs";
import { z } from "zod";

const schema = z.array(z.object({ id: z.string().min(1), organization_id: z.string().uuid(), contact_id: z.string().uuid(), input_events: z.array(z.unknown()), query: z.string().min(1), expected: z.object({ must_include: z.array(z.string()), must_not_include: z.array(z.string()), authority_domain: z.string().min(1), risk: z.enum(["low", "medium", "high"]) }) })).min(25);
const cases = schema.parse(JSON.parse(readFileSync(new URL("../tests/fixtures/ai-platform/golden-cases.json", import.meta.url), "utf8")));
const duplicates = cases.length - new Set(cases.map((item) => item.id)).size;
const summary = { total: cases.length, duplicate_ids: duplicates, p0_failures: duplicates, status: duplicates === 0 ? "pass" : "fail" };
console.log(JSON.stringify(summary));
if (duplicates) process.exitCode = 1;
