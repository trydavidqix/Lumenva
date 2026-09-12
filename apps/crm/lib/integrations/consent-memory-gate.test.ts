import { describe, expect, it } from "vitest";
import { ConsentRegistry } from "./consent-registry";
import { evaluateContactMemoryGate, type ContactMemoryWrite, type MemoryGatePolicy } from "./consent-memory-gate";

const write: ContactMemoryWrite = { owner: "agent-1", scope: "company:org-1", authority: 3, organization_id: "org-1", subject_ref: "contact-1", channel: "email", purpose: "support" };
const policy: MemoryGatePolicy = { owner: "agent-1", scope: "company:org-1", authority: 2 };
function grantedRegistry(): ConsentRegistry { const registry = new ConsentRegistry(); registry.register({ consent_id: "consent-1", organization_id: "org-1", subject_ref: "contact-1", purpose: "support", channel: "email", source_refs: [], evidence_refs: [] }); return registry; }

describe("Consent-aware MemoryGate", () => {
  it("allows a contact memory write only with active channel consent", () => {
    expect(evaluateContactMemoryGate(write, policy, grantedRegistry())).toBe("ALLOW");
  });
  it("fails closed when consent is absent", () => {
    expect(evaluateContactMemoryGate(write, policy, new ConsentRegistry())).toBe("DENY");
  });
  it("fails closed after consent is revoked", () => {
    const registry = grantedRegistry(); registry.revoke("org-1", "consent-1");
    expect(evaluateContactMemoryGate(write, policy, registry)).toBe("DENY");
  });
  it("fails closed for a different channel or purpose", () => {
    expect(evaluateContactMemoryGate({ ...write, channel: "voice" }, policy, grantedRegistry())).toBe("DENY");
    expect(evaluateContactMemoryGate({ ...write, purpose: "marketing" }, policy, grantedRegistry())).toBe("DENY");
  });
});
