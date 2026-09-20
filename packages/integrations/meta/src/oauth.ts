/** Instagram API with Instagram Login (standalone, sem Facebook Page). */

const INSTAGRAM_GRAPH = "https://graph.instagram.com/v21.0";

export interface InstagramTokens {
  accessToken: string;
  userId: string;
  expiresAt: number;
}

type TokenResponse = {
  access_token?: unknown;
  user_id?: unknown;
  expires_in?: unknown;
  error_message?: unknown;
  error_type?: unknown;
  /** o /oauth/access_token novo devolve o payload dentro de data[0] */
  data?: unknown;
};

const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60;

/** Normaliza a resposta: às vezes vem embrulhada em { data: [ { ... } ] }. */
function unwrap(body: TokenResponse): TokenResponse {
  if (Array.isArray(body.data) && body.data.length > 0 && typeof body.data[0] === "object") {
    return body.data[0] as TokenResponse;
  }
  return body;
}

function tokenFromResponse(raw: TokenResponse, fallbackUserId?: string): InstagramTokens {
  const body = unwrap(raw);
  if (typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new Error(String(body.error_message ?? raw.error_message ?? "Instagram API não devolveu access_token"));
  }
  const userId =
    typeof body.user_id === "string" || typeof body.user_id === "number"
      ? String(body.user_id)
      : fallbackUserId;
  if (!userId) throw new Error("Instagram API não devolveu user_id");
  const expiresIn = typeof body.expires_in === "number" && Number.isFinite(body.expires_in) && body.expires_in > 0
    ? body.expires_in
    : SIXTY_DAYS_SECONDS;
  return { accessToken: body.access_token, userId, expiresAt: Math.floor(Date.now() / 1000) + expiresIn };
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  const baseScopes = ["instagram_business_basic", "instagram_business_content_publish"];
  const extraScopes = (process.env.INSTAGRAM_EXTRA_SCOPES ?? "").split(",").map((scope) => scope.trim()).filter((scope) => /^[a-z][a-z0-9_]+$/i.test(scope));
  url.searchParams.set("scope", [...new Set([...baseScopes, ...extraScopes])].join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<InstagramTokens> {
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: opts.redirectUri,
      code: opts.code,
    }),
  });
  const body = (await readJson(response)) as TokenResponse;
  if (!response.ok) throw new Error(String(body.error_message ?? `Instagram OAuth error (${response.status})`));
  return tokenFromResponse(body);
}

export async function toLongLived(opts: {
  clientId: string;
  clientSecret: string;
  shortToken: string;
  userId: string;
}): Promise<InstagramTokens> {
  const url = new URL(`${INSTAGRAM_GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", opts.clientSecret);
  url.searchParams.set("access_token", opts.shortToken);
  const response = await fetch(url);
  const body = (await readJson(response)) as TokenResponse;
  if (!response.ok) throw new Error(String(body.error_message ?? `Instagram Graph error (${response.status})`));
  return tokenFromResponse(body, opts.userId);
}

/**
 * Renova um token long-lived de Instagram standalone. O endpoint de refresh
 * não devolve user_id — passa-se o atual como fallback (a identidade não muda).
 */
export async function refreshToken(accessToken: string, userId: string): Promise<InstagramTokens> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const body = (await readJson(response)) as TokenResponse;
  if (!response.ok) throw new Error(String(body.error_message ?? `Instagram Graph error (${response.status})`));
  return tokenFromResponse(body, userId);
}

export { signState, verifyState } from "../meta/oauth";
export { INSTAGRAM_GRAPH };
