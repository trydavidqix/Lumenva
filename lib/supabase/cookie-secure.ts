/**
 * Secure do cookie de sessão derivado do PROTOCOLO da URL pública do app —
 * não de NODE_ENV. Motivo (achado nº 8 do deploy VPS): self-host por HTTP
 * (sem TLS) com NODE_ENV=production setava Secure=true e o navegador
 * DESCARTAVA o cookie — login autenticava e voltava para a tela de login.
 * https → Secure (produção com TLS); http → não-Secure (self-host/porta alta).
 * Sem NEXT_PUBLIC_APP_URL definido, cai no comportamento antigo (NODE_ENV).
 */
export function cookieSecure(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl.startsWith("https://")) return true;
  if (appUrl.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}
