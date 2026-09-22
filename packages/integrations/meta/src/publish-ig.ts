import { parseMetaError } from "./errors";
import { INSTAGRAM_GRAPH } from "./oauth";

export interface InstagramPublishResult { id: string }

export async function uploadReelContainer(opts: { igUserId: string; accessToken: string; videoUrl: string; caption: string }): Promise<{ containerId: string }> {
  const response = await fetch(`${INSTAGRAM_GRAPH}/${encodeURIComponent(opts.igUserId)}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ media_type: 'REELS', video_url: opts.videoUrl, caption: opts.caption, access_token: opts.accessToken }) });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw parseMetaError(body);
  const id = (body as { id?: unknown } | undefined)?.id;
  if (typeof id !== 'string' || !id) throw new Error('Instagram API não devolveu o container do reel');
  return { containerId: id };
}

type InstagramPublishOptions = {
  igUserId: string;
  accessToken: string;
  imageUrls: string[];
  caption: string;
  pollIntervalMs?: number;
  maxPolls?: number;
  /** Permite reutilizar o fluxo com o endpoint via-Página (graph.facebook.com). */
  graphBase?: string;
};

/**
 * Publica um carrossel no Instagram Graph API.
 *
 * Cada imagem é primeiro criada como um container `is_carousel_item`; em
 * seguida é criado o container CAROUSEL, que é processado até FINISHED antes
 * de ser publicado. O `graphBase` é opcional para que o mesmo fluxo possa ser
 * usado com tokens via-Página; por omissão usa o endpoint standalone.
 */
export async function publishCarousel(opts: InstagramPublishOptions): Promise<InstagramPublishResult> {
  if (!Number.isInteger(opts.imageUrls.length) || opts.imageUrls.length < 2 || opts.imageUrls.length > 10) {
    throw new Error("O carrossel do Instagram precisa de 2 a 10 imagens");
  }

  const pollIntervalMs = opts.pollIntervalMs ?? 1_000;
  const maxPolls = opts.maxPolls ?? 30;
  if (!Number.isInteger(maxPolls) || maxPolls < 1) throw new Error("maxPolls deve ser um inteiro positivo");
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) throw new Error("pollIntervalMs deve ser um número não negativo");

  const graph = (opts.graphBase ?? INSTAGRAM_GRAPH).replace(/\/$/, "");
  const base = `${graph}/${encodeURIComponent(opts.igUserId)}`;
  const children: string[] = [];

  for (const imageUrl of opts.imageUrls) {
    const response = await fetch(`${base}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: "true",
        access_token: opts.accessToken,
      }),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw parseMetaError(body);
    const id = (body as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) throw new Error("Instagram API não devolveu o ID do item do carrossel");
    children.push(id);
  }

  const createResponse = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: opts.caption,
      access_token: opts.accessToken,
    }),
  });
  const createBody: unknown = await createResponse.json().catch(() => undefined);
  if (!createResponse.ok) throw parseMetaError(createBody);
  const creationId = (createBody as { id?: unknown })?.id;
  if (typeof creationId !== "string" || !creationId) throw new Error("Instagram API não devolveu o creation_id do carrossel");

  let status = "";
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0 && pollIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetch(`${graph}/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(opts.accessToken)}`);
    const statusBody: unknown = await statusResponse.json().catch(() => undefined);
    if (!statusResponse.ok) throw parseMetaError(statusBody);
    status = String((statusBody as { status_code?: unknown })?.status_code ?? "");
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") throw parseMetaError({ error: { message: `Instagram media container ${status.toLowerCase()}` } });
  }
  if (status !== "FINISHED") throw new Error(`Timeout ao processar container do Instagram após ${maxPolls} tentativas`);

  const publishResponse = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: opts.accessToken }),
  });
  const publishBody: unknown = await publishResponse.json().catch(() => undefined);
  if (!publishResponse.ok) throw parseMetaError(publishBody);
  const id = (publishBody as { id?: unknown })?.id;
  if (typeof id !== "string" || !id) throw new Error("Instagram API não devolveu o ID da publicação");
  return { id };
}

export async function publishPhoto(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  pollIntervalMs?: number;
  maxPolls?: number;
}): Promise<InstagramPublishResult> {
  const pollIntervalMs = opts.pollIntervalMs ?? 1_000;
  const maxPolls = opts.maxPolls ?? 30;
  if (!Number.isInteger(maxPolls) || maxPolls < 1) throw new Error("maxPolls deve ser um inteiro positivo");
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) throw new Error("pollIntervalMs deve ser um número não negativo");
  const base = `${INSTAGRAM_GRAPH}/${encodeURIComponent(opts.igUserId)}`;
  const createResponse = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: opts.imageUrl, caption: opts.caption, access_token: opts.accessToken }),
  });
  const createBody: unknown = await createResponse.json().catch(() => undefined);
  if (!createResponse.ok) throw parseMetaError(createBody);
  const creationId = (createBody as { id?: unknown })?.id;
  if (typeof creationId !== "string" || !creationId) throw new Error("Instagram API não devolveu o creation_id");

  let status = "";
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0 && pollIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetch(`${INSTAGRAM_GRAPH}/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(opts.accessToken)}`);
    const statusBody: unknown = await statusResponse.json().catch(() => undefined);
    if (!statusResponse.ok) throw parseMetaError(statusBody);
    status = String((statusBody as { status_code?: unknown })?.status_code ?? "");
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") throw parseMetaError({ error: { message: `Instagram media container ${status.toLowerCase()}` } });
  }
  if (status !== "FINISHED") throw new Error(`Timeout ao processar container do Instagram após ${maxPolls} tentativas`);
  const publishResponse = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: opts.accessToken }),
  });
  const publishBody: unknown = await publishResponse.json().catch(() => undefined);
  if (!publishResponse.ok) throw parseMetaError(publishBody);
  const id = (publishBody as { id?: unknown })?.id;
  if (typeof id !== "string" || !id) throw new Error("Instagram API não devolveu o ID da publicação");
  return { id };
}
