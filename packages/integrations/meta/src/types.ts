export type WebhookPlatform = "facebook" | "instagram";
export interface Account { id: string; platform: WebhookPlatform; externalId: string; accessToken: string; }
export type WebhookEventType = "comment" | "message" | "reaction" | "unknown";
export interface NormalizedWebhookEvent { platform: WebhookPlatform; externalEventId: string; accountId?: string; eventType: WebhookEventType; accountExternalId?: string; text?: string; actor?: { id?: string; username?: string; name?: string }; postExternalId?: string; parentExternalId?: string; timestamp?: number; payload: Record<string, unknown>; }

export function normalizeMetaPayload(input: Record<string, unknown>): NormalizedWebhookEvent[] {
  const object = input.object === "instagram" ? "instagram" : input.object === "page" ? "facebook" : undefined;
  const entries = Array.isArray(input.entry) ? input.entry as Record<string, unknown>[] : [];
  const out: NormalizedWebhookEvent[] = [];
  for (const entry of entries) {
    const accountExternalId = typeof entry.id === "string" ? entry.id : undefined;
    const changes = Array.isArray(entry.changes) ? entry.changes as Record<string, unknown>[] : [];
    for (const change of changes) {
      const value = (change.value && typeof change.value === "object" ? change.value : {}) as Record<string, unknown>;
      const field = typeof change.field === "string" ? change.field : "unknown";
      const id = typeof value.id === "string" ? value.id : `${accountExternalId ?? "unknown"}:${field}:${JSON.stringify(value)}`;
      out.push({ platform: object ?? "instagram", externalEventId: id, eventType: field.includes("comment") ? "comment" : field.includes("message") ? "message" : field.includes("reaction") ? "reaction" : "unknown", accountExternalId, text: typeof value.text === "string" ? value.text : undefined, actor: value.from && typeof value.from === "object" ? value.from as { id?: string; username?: string; name?: string } : undefined, postExternalId: typeof value.media_id === "string" ? value.media_id : typeof value.post_id === "string" ? value.post_id : undefined, parentExternalId: typeof value.parent_id === "string" ? value.parent_id : undefined, timestamp: typeof value.created_time === "number" ? value.created_time : undefined, payload: input });
    }
  }
  return out;
}
