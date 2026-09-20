import type { Account } from "@/lib/db/schema";
import { persistInboxEvent } from "@/lib/inbox/normalize";
import type { NormalizedWebhookEvent } from "@/lib/webhooks/types";
import { INSTAGRAM_GRAPH } from "./oauth";

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => value && typeof value === "object" ? value as Json : {};
const str = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && value.length > 0);
const num = (...values: unknown[]) => values.find((value): value is number => typeof value === "number" && Number.isFinite(value));

async function getJson(url: URL): Promise<Json> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = obj(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(str(obj(body.error).message, `Instagram inbox error (${response.status})`) ?? "Instagram inbox error");
  return body;
}

/** Faz uma reconciliação read-only das conversas recentes do Instagram. */
export async function syncInstagramInbox(account: Account, limit = 25): Promise<{ conversations: number; messages: number; duplicates: number }> {
  if (account.platform !== "instagram") return { conversations: 0, messages: 0, duplicates: 0 };
  const listUrl = new URL(`${INSTAGRAM_GRAPH}/${encodeURIComponent(account.externalId)}/conversations`);
  listUrl.searchParams.set("platform", "instagram");
  listUrl.searchParams.set("limit", String(Math.min(50, Math.max(1, limit))));
  listUrl.searchParams.set("access_token", account.accessToken);
  const list = await getJson(listUrl);
  const conversations = Array.isArray(list.data) ? list.data as unknown[] : [];
  let messageCount = 0; let duplicates = 0;
  for (const rawConversation of conversations) {
    const conversation = obj(rawConversation);
    const threadId = str(conversation.id);
    if (!threadId) continue;
    const detailUrl = new URL(`${INSTAGRAM_GRAPH}/${encodeURIComponent(threadId)}`);
    detailUrl.searchParams.set("fields", "messages{message,from,to,created_time,id}");
    detailUrl.searchParams.set("access_token", account.accessToken);
    const detail = await getJson(detailUrl);
    const messages = obj(detail.messages).data;
    if (!Array.isArray(messages)) continue;
    for (const rawMessage of messages) {
      const message = obj(rawMessage);
      const actor = obj(message.from);
      const text = str(message.message);
      const messageId = str(message.id);
      if (!text || !messageId) continue;
      const event: NormalizedWebhookEvent = {
        platform: "instagram", externalEventId: `sync:${messageId}`, eventType: "message",
        accountExternalId: account.externalId, text, parentExternalId: threadId,
        actor: { id: str(actor.id) ?? "unknown", username: str(actor.username), name: str(actor.name) },
        timestamp: num(message.created_time) ?? Math.floor(Date.now() / 1000), payload: detail,
      };
      const result = persistInboxEvent(event, account.id);
      if (!result) continue;
      messageCount++; if (result.duplicate) duplicates++;
    }
  }
  return { conversations: conversations.length, messages: messageCount, duplicates };
}
