export const IMPERSONATE_COOKIE_NAME = "lumenva-impersonate";
export const IMPERSONATE_COOKIE_NAME_LEGACY = "deskcomm-impersonate";

/** Lê o cookie novo primeiro e mantém sessões emitidas com o nome antigo. */
export function readImpersonateCookie(
  get: (name: string) => { value: string } | undefined,
): string | null {
  return get(IMPERSONATE_COOKIE_NAME)?.value ?? get(IMPERSONATE_COOKIE_NAME_LEGACY)?.value ?? null;
}
