/**
 * Publicar imagem única + legenda numa Página do Facebook.
 * 1 passo: POST /{page-id}/photos { url, caption, access_token }.
 * Graph API v21.0.
 */

import { parseMetaError } from "./errors";
import { GRAPH } from "./oauth";

export interface PublishResult {
  id: string; // post id devolvido pela Graph API
}

export async function publishFacebookPhoto(opts: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  const response = await fetch(`${GRAPH}/${encodeURIComponent(opts.pageId)}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      url: opts.imageUrl,
      caption: opts.caption,
      access_token: opts.pageAccessToken,
    }),
  });

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw parseMetaError(body);
  const id = (body as { id?: unknown; post_id?: unknown } | undefined)?.post_id
    ?? (body as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string" || !id) {
    throw new Error("Meta não devolveu o ID da publicação do Facebook");
  }
  return { id };
}

/**
 * Publica um carrossel numa Página do Facebook.
 *
 * A Graph API não aceita URLs de imagem diretamente em `/{page-id}/feed`.
 * Primeiro criamos cada fotografia como não publicada (`published=false`) e
 * depois anexamos os IDs devolvidos à publicação do feed.
 */
export async function publishFacebookCarousel(opts: {
  pageId: string;
  pageAccessToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<PublishResult> {
  if (opts.imageUrls.length < 2 || opts.imageUrls.length > 10) {
    throw new Error("O carrossel do Facebook precisa de 2 a 10 imagens");
  }

  const mediaIds: string[] = [];
  for (const imageUrl of opts.imageUrls) {
    const response = await fetch(`${GRAPH}/${encodeURIComponent(opts.pageId)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        url: imageUrl,
        published: "false",
        access_token: opts.pageAccessToken,
      }),
    });

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw parseMetaError(body);
    const id = (body as { id?: unknown } | undefined)?.id;
    if (typeof id !== "string" || !id) {
      throw new Error("Meta não devolveu o ID da fotografia do carrossel do Facebook");
    }
    mediaIds.push(id);
  }

  const feedParams = new URLSearchParams({
    message: opts.caption,
    access_token: opts.pageAccessToken,
  });
  mediaIds.forEach((mediaId, index) => {
    feedParams.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: mediaId }));
  });

  const response = await fetch(`${GRAPH}/${encodeURIComponent(opts.pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: feedParams,
  });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw parseMetaError(body);
  const id = (body as { id?: unknown; post_id?: unknown } | undefined)?.post_id
    ?? (body as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string" || !id) {
    throw new Error("Meta não devolveu o ID da publicação do carrossel do Facebook");
  }
  return { id };
}
