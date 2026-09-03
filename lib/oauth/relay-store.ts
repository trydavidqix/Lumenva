import { createHash, randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export function relayResource(issuer = env.MCP_RELAY_ISSUER): string { return `${issuer}/api/mcp/relay`; }
export const RELAY_RESOURCE = relayResource();
export const RELAY_SCOPE = "email:relay";
const CODE_TTL = 300;
const TOKEN_TTL = 900;

export interface RelayClient { clientId: string; clientName: string; redirectUris: string[] }
export interface RelayOAuthGrant { clientId: string; redirectUri: string; resource: string; scope: string; }
export interface RelayAccessGrant extends RelayOAuthGrant { expiresAt: number }

const memory = new Map<string, { value: unknown; expiresAt: number }>();
let redis: Redis | null | undefined;

function backend(): Redis | null {
  if (redis !== undefined) return redis;
  redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, retry: false })
    : null;
  return redis;
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function opaque(prefix: string): string { return `${prefix}_${randomBytes(32).toString("base64url")}`; }
async function put(key: string, value: unknown, ttl: number): Promise<void> {
  const r = backend();
  if (r) { await r.set(key, JSON.stringify(value), { ex: ttl }); return; }
  memory.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}
async function get<T>(key: string): Promise<T | null> {
  const r = backend();
  if (r) { const raw = await r.get<string>(key); return raw ? JSON.parse(raw) as T : null; }
  const item = memory.get(key);
  if (!item || item.expiresAt <= Date.now()) { memory.delete(key); return null; }
  return item.value as T;
}
async function del(key: string): Promise<void> { const r = backend(); if (r) await r.del(key); else memory.delete(key); }

export async function registerClient(input: { clientName?: string; redirectUris: string[] }): Promise<RelayClient> {
  const clientId = opaque("cli");
  const client: RelayClient = { clientId, clientName: input.clientName?.slice(0, 120) || "ChatGPT", redirectUris: input.redirectUris };
  await put(`mcp-relay:client:${hash(clientId)}`, client, 365 * 24 * 60 * 60);
  return client;
}
export async function getClient(clientId: string): Promise<RelayClient | null> { return get<RelayClient>(`mcp-relay:client:${hash(clientId)}`); }
export function pkceChallenge(verifier: string): string { return createHash("sha256").update(verifier).digest("base64url"); }
export function verifyPkce(verifier: string, challenge: string): boolean { return pkceChallenge(verifier) === challenge; }
export async function createAuthorizationCode(input: RelayOAuthGrant & { codeChallenge: string }): Promise<string> {
  const code = opaque("code");
  await put(`mcp-relay:code:${hash(code)}`, { ...input }, CODE_TTL);
  return code;
}
export async function consumeAuthorizationCode(code: string, verifier: string, expected: RelayOAuthGrant): Promise<boolean> {
  const key = `mcp-relay:code:${hash(code)}`;
  const record = await get<RelayOAuthGrant & { codeChallenge: string }>(key);
  if (!record || !verifyPkce(verifier, record.codeChallenge) || record.clientId !== expected.clientId || record.redirectUri !== expected.redirectUri || record.resource !== expected.resource) return false;
  await del(key); return true;
}
export async function issueAccessToken(grant: RelayOAuthGrant): Promise<{ accessToken: string; expiresIn: number }> {
  const accessToken = opaque("at");
  await put(`mcp-relay:token:${hash(accessToken)}`, { ...grant, expiresAt: Date.now() + TOKEN_TTL * 1000 }, TOKEN_TTL);
  return { accessToken, expiresIn: TOKEN_TTL };
}
export async function validateAccessToken(token: string): Promise<RelayAccessGrant | null> {
  const grant = await get<RelayAccessGrant>(`mcp-relay:token:${hash(token)}`);
  return grant && grant.expiresAt > Date.now() ? grant : null;
}
export async function revokeAccessToken(token: string): Promise<void> { await del(`mcp-relay:token:${hash(token)}`); }
