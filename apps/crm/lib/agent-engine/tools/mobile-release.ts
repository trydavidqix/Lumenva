import { z } from "zod";
import { createInternalToolDefinitions } from "./registry";

const releaseIdentity = {
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  build_ref: z.string().min(1),
  artifact_ref: z.string().min(1),
  artifact_hash: z.string().min(16),
  platform: z.enum(["IOS", "ANDROID"]),
};

export const MOBILE_RELEASE_TOOL_DEFS = {
  mobile_compliance_audit: {
    description: "Audit a mobile build against the canonical Lumenva Apple/Google compliance policy snapshot. Read-only; it cannot submit or mutate the store release.",
    inputSchema: z.object({ ...releaseIdentity, runtime_required: z.boolean().default(false) }),
  },
  mobile_runtime_review: {
    description: "Run the configured iOS Simulator or Android Emulator reviewer for a specific immutable build identity. Read-only with respect to production/store state.",
    inputSchema: z.object(releaseIdentity),
  },
  mobile_compliance_autofix: {
    description: "Apply only deterministic, reversible low-risk mobile compliance fixes to a working branch. Never changes store submission state or legal/business declarations.",
    inputSchema: z.object({ ...releaseIdentity, finding_fingerprints: z.array(z.string().min(1)).min(1) }),
  },
  mobile_store_submit: {
    description: "Submit an already certified mobile build to App Store Connect or Google Play. Sensitive commercial side effect; Agent OS policy must require explicit approval.",
    inputSchema: z.object({ ...releaseIdentity, compliance_report_ref: z.string().min(1), runtime_review_ref: z.string().min(1), approval_id: z.string().min(1) }),
  },
} as const;

export function createMobileReleaseToolDefinitions() {
  return createInternalToolDefinitions(MOBILE_RELEASE_TOOL_DEFS);
}
