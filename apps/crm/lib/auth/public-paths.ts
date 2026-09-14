/**
 * Paths that bypass auth check in middleware.
 * Match precedence: array order. First match wins.
 */
export const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/login(\/.*)?$/,
  /^\/signup$/,
  /^\/auth\/confirm$/,
  /^\/403$/,
  /^\/admin\/forbidden$/,
  /^\/404$/,
  /^\/500$/,
  /^\/503$/,
  /^\/api\/v1\/health$/,
  /^\/api\/v1\/webhooks\//,
  // Stripe verifies authenticity with the provider signature, not a user session.
  /^\/api\/v1\/stripe\/webhook$/,
  /^\/api\/v1\/cron\//,
  // Inngest serve endpoint performs its own protocol/signature checks and must
  // be reachable without a Lumenva browser session for local/cloud sync.
  /^\/api\/inngest$/,
  // Phase 7 Vercel Workflow benchmark endpoints are public only at middleware
  // level; each route is hard-disabled outside local development and accepts
  // synthetic benchmark organizations only.
  /^\/api\/phase7\/vercel-workflow(\/.*)?$/,
  // Heartbeat do agente do host (bearer INTERNAL_SECRET/INTERNAL_CRON_SECRET,
  // checado dentro da própria rota) — sem cookie de sessão, igual /cron/.
  /^\/api\/v1\/system\/agent$/,
  /^\/api\/internal\//,
  // OAuth client registration and authorization-code handshake authenticate
  // internally (approval secret and PKCE), without a browser session cookie.
  /^\/api\/oauth\/(register|authorize|token)$/,
  /^\/api\/mcp(\/.*)?$/,
  /^\/.well-known\/oauth-authorization-server$/,
  /^\/.well-known\/oauth-protected-resource(\/.*)?$/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/team\/accept-invite\/.+$/,
  /^\/account-suspended$/,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}
