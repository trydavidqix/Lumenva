/** Descoberta de Páginas Facebook e contas Instagram Business ligadas. */
import { GRAPH } from "./oauth";

export interface DiscoveredAccount {
  platform: "facebook" | "instagram";
  externalId: string;
  name: string;
  pageId: string | null;
  pageAccessToken: string;
}

type Page = {
  id?: unknown;
  name?: unknown;
  access_token?: unknown;
  instagram_business_account?: { id?: unknown };
};

async function getPage(url: string): Promise<{ data?: Page[]; paging?: { next?: string } }> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as { data?: Page[]; paging?: { next?: string }; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `Meta Graph API error (${response.status})`);
  return body;
}

export async function discoverAccounts(userToken: string): Promise<DiscoveredAccount[]> {
  const pages: Page[] = [];
  const seen = new Set<string>();
  let next: string | undefined = `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${encodeURIComponent(userToken)}`;
  while (next) {
    const body = await getPage(next);
    for (const page of body.data ?? []) {
      const id = typeof page.id === "string" ? page.id : "";
      if (id && !seen.has(id)) { seen.add(id); pages.push(page); }
    }
    next = body.paging?.next;
  }

  const accounts: DiscoveredAccount[] = [];
  for (const page of pages) {
    if (typeof page.id !== "string" || typeof page.access_token !== "string") continue;
    accounts.push({ platform: "facebook", externalId: page.id, name: typeof page.name === "string" ? page.name : page.id, pageId: page.id, pageAccessToken: page.access_token });
    const instagramId = page.instagram_business_account?.id;
    if (typeof instagramId !== "string") continue;
    const profileUrl = new URL(`${GRAPH}/${encodeURIComponent(instagramId)}`);
    profileUrl.searchParams.set("fields", "id,name,username,profile_picture_url");
    profileUrl.searchParams.set("access_token", page.access_token);
    const profileResponse = await fetch(profileUrl);
    const profile = (await profileResponse.json().catch(() => ({}))) as { id?: unknown; name?: unknown; username?: unknown; error?: { message?: string } };
    if (!profileResponse.ok || profile.error) throw new Error(profile.error?.message ?? `Meta Graph API error (${profileResponse.status})`);
    accounts.push({ platform: "instagram", externalId: instagramId, name: typeof profile.name === "string" ? profile.name : typeof profile.username === "string" ? profile.username : instagramId, pageId: page.id, pageAccessToken: page.access_token });
  }
  return accounts;
}

export { GRAPH };
