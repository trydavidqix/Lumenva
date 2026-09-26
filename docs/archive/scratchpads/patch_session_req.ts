import fs from "fs";
const file = "apps/crm/app/api/v1/onboarding/whatsapp/session/route.ts";
let content = fs.readFileSync(file, "utf8");

// GET does not use request but Next.js router might complain if it's there but unused, let's look at the source
