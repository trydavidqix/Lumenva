import { GRAPH } from "./oauth";
import { INSTAGRAM_GRAPH } from "@/lib/instagram/oauth";
import { parseMetaError } from "./errors";
import type { Account } from "@/lib/db/schema";
type Input = { platform: "facebook" | "instagram"; commentId: string; text: string; account: Account };
async function send(path: string, token: string, text: string) { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ message: text, access_token: token }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw parseMetaError(body); const id = (body as { id?: unknown })?.id; if (typeof id !== "string") throw parseMetaError(body); return { id }; }
export function sendPublicReply(input: Input) { const base = input.platform === "instagram" ? INSTAGRAM_GRAPH : GRAPH; const path = input.platform === "instagram" ? `${base}/${encodeURIComponent(input.commentId)}/replies` : `${base}/${encodeURIComponent(input.commentId)}/comments`; return send(path, input.account.accessToken, input.text); }
export function sendPrivateReply(input: Input) { const base = input.platform === "instagram" ? INSTAGRAM_GRAPH : GRAPH; return send(`${base}/${encodeURIComponent(input.commentId)}/private_replies`, input.account.accessToken, input.text); }

export async function sendDirectMessage(input: { platform: "facebook" | "instagram"; recipientId: string; text: string; account: Account }) {
  const base = input.platform === "instagram" ? INSTAGRAM_GRAPH : GRAPH;
  const path = input.platform === "instagram" ? `${base}/${encodeURIComponent(input.account.externalId)}/messages` : `${base}/${encodeURIComponent(input.account.externalId)}/messages`;
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: input.recipientId }, message: { text: input.text }, access_token: input.account.accessToken }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw parseMetaError(body);
  const id = (body as { message_id?: unknown; id?: unknown }).message_id ?? (body as { id?: unknown }).id;
  if (typeof id !== "string") throw parseMetaError(body);
  return { id };
}
