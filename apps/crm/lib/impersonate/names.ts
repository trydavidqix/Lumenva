export const IMPERSONATE_COOKIE_NAME = "lumenva-impersonate";

export function readImpersonateCookie(
  get: (name: string) => { value: string } | undefined,
): string | null {
  return get(IMPERSONATE_COOKIE_NAME)?.value ?? null;
}
