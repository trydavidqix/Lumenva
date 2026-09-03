import { describe, expect, it } from "vitest";
import { consumeAuthorizationCode, createAuthorizationCode, issueAccessToken, pkceChallenge, relayResource, validateAccessToken } from "@/lib/oauth/relay-store";

describe("MCP relay OAuth primitives", () => {
  it("binds a one-time code to PKCE and client/resource", async () => {
    const verifier = "v".repeat(64);
    const grant = { clientId: "client-test", redirectUri: "https://client.test/cb", resource: relayResource("https://crm.test"), scope: "email:relay" };
    const code = await createAuthorizationCode({ ...grant, codeChallenge: pkceChallenge(verifier) });
    expect(await consumeAuthorizationCode(code, verifier, grant)).toBe(true);
    expect(await consumeAuthorizationCode(code, verifier, grant)).toBe(false);
  });

  it("issues and validates a scoped audience-bound access token", async () => {
    const grant = { clientId: "client-test", redirectUri: "https://client.test/cb", resource: relayResource("https://crm.test"), scope: "email:relay" };
    const issued = await issueAccessToken(grant);
    expect((await validateAccessToken(issued.accessToken))?.resource).toBe(grant.resource);
    expect(await validateAccessToken("at_invalid")).toBeNull();
  });
});
