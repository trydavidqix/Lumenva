import { INSTAGRAM_GRAPH } from "./oauth";
import { parseMetaError } from "../meta/errors";

type GraphErrorBody = { error?: unknown };

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || body.error) throw parseMetaError(body.error ? body : { error: { message: `Instagram Graph API error (${response.status})` } });
  return body;
}

export interface InstagramComment {
  id: string;
  text: string;
  username: string | null;
  timestamp: string | null;
  likeCount: number | null;
  mediaId: string;
}

export interface InstagramCommentsResult {
  comments: InstagramComment[];
  next: string | null;
}

export interface InstagramPermission { permission: string; status: string; }

export async function listInstagramComments(opts: { userId: string; accessToken: string; limit?: number; after?: string }): Promise<InstagramCommentsResult> {
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 50)));
  const mediaUrl = new URL(`${INSTAGRAM_GRAPH}/${encodeURIComponent(opts.userId)}/media`);
  mediaUrl.searchParams.set("fields", "id,comments.limit(100){id,text,username,timestamp,like_count}");
  mediaUrl.searchParams.set("limit", String(Math.min(100, limit)));
  mediaUrl.searchParams.set("access_token", opts.accessToken);
  if (opts.after) mediaUrl.searchParams.set("after", opts.after);
  const media = await getJson<{ data?: Array<{ id?: unknown; comments?: { data?: Array<Record<string, unknown>>; paging?: { next?: string } } }> }>(mediaUrl);
  const comments: InstagramComment[] = [];
  for (const item of media.data ?? []) {
    const mediaId = typeof item.id === "string" ? item.id : "";
    for (const comment of item.comments?.data ?? []) {
      if (!mediaId || typeof comment.id !== "string" || typeof comment.text !== "string") continue;
      comments.push({ id: comment.id, text: comment.text, username: typeof comment.username === "string" ? comment.username : null, timestamp: typeof comment.timestamp === "string" ? comment.timestamp : null, likeCount: typeof comment.like_count === "number" ? comment.like_count : null, mediaId });
      if (comments.length >= limit) return { comments, next: item.comments?.paging?.next ?? null };
    }
  }
  return { comments, next: null };
}

export interface InstagramInsight {
  name: string;
  period: string | null;
  values: Array<{ value: number | string | null; endTime: string | null }>;
  title: string | null;
  description: string | null;
}

export async function getInstagramInsights(opts: { userId: string; accessToken: string; metrics: string[]; period?: string; since?: number; until?: number }): Promise<InstagramInsight[]> {
  const metrics = [...new Set(opts.metrics)].filter((metric) => /^[a-z][a-z0-9_]+$/i.test(metric));
  if (metrics.length === 0 || metrics.length > 25) throw new Error("metrics deve conter entre 1 e 25 nomes válidos");
  const url = new URL(`${INSTAGRAM_GRAPH}/${encodeURIComponent(opts.userId)}/insights`);
  url.searchParams.set("metric", metrics.join(","));
  if (opts.period) url.searchParams.set("period", opts.period);
  if (typeof opts.since === "number") url.searchParams.set("since", String(Math.floor(opts.since)));
  if (typeof opts.until === "number") url.searchParams.set("until", String(Math.floor(opts.until)));
  url.searchParams.set("access_token", opts.accessToken);
  const body = await getJson<{ data?: Array<{ name?: unknown; period?: unknown; values?: Array<{ value?: unknown; end_time?: unknown }>; title?: unknown; description?: unknown }> }>(url);
  return (body.data ?? []).filter((item) => typeof item.name === "string").map((item) => ({ name: item.name as string, period: typeof item.period === "string" ? item.period : null, values: (item.values ?? []).map((value) => ({ value: typeof value.value === "number" || typeof value.value === "string" ? value.value : null, endTime: typeof value.end_time === "string" ? value.end_time : null })), title: typeof item.title === "string" ? item.title : null, description: typeof item.description === "string" ? item.description : null }));
}

/** Best-effort introspection; standalone Instagram tokens may not expose this edge. */
export async function getInstagramPermissions(accessToken: string): Promise<InstagramPermission[]> {
  const url = new URL(`${INSTAGRAM_GRAPH}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  const body = await getJson<{ data?: Array<Record<string, unknown>> }>(url);
  return (body.data ?? []).flatMap((entry) => {
    const permission = typeof entry.permission === "string" ? entry.permission : "";
    const status = typeof entry.status === "string" ? entry.status : "";
    return permission && status ? [{ permission, status }] : [];
  });
}
