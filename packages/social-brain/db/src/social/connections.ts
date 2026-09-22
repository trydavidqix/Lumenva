export { createSupabaseSocialConnectionRepository } from './account-repository'

export type SocialConnection = {
  id: string
  workspaceId: string
  provider: string
  platform: string
  externalAccountId: string | null
  accessToken: string | null
  tokenExpiresAt: Date | null
  [key: string]: unknown
}

export type SocialConnectionRepository = {
  findConnectionsNearingExpiration(thresholdMs: number): Promise<SocialConnection[]>
  upsertConnection(connection: SocialConnection): Promise<void>
  updateConnectionStatus(id: string, status: string): Promise<void>
}
