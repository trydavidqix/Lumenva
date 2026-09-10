import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "supabase", "migrations");
const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
console.log(JSON.stringify({ baseline: "supabase/baseline.sql", migrations: files, execute: false }, null, 2));
