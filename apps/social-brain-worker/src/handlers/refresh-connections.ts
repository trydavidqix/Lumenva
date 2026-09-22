import type { BackgroundJob } from '@lumenva/db/jobs'
import type { SocialConnectionRepository } from '@lumenva/db/social/connections'
import { oauth } from '@lumenva/integration-meta'

export type RefreshConnectionsDependencies = {
  repository: SocialConnectionRepository
  metaClientId: string
  metaClientSecret: string
}

const EXPIRATION_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function createRefreshConnectionsHandler(deps: RefreshConnectionsDependencies) {
  return async function refreshConnections(job: BackgroundJob): Promise<void> {
    if (job.jobType !== 'social.connection.refresh') {
      throw new Error('Expected social.connection.refresh job')
    }

    const connections = await deps.repository.findConnectionsNearingExpiration(EXPIRATION_THRESHOLD_MS)

    for (const connection of connections) {
      if (!connection.accessToken) continue

      try {
        if (connection.provider === 'meta' && connection.platform === 'instagram') {
          const freshTokens = await oauth.refreshToken(connection.accessToken, connection.externalAccountId || '')
          
          await deps.repository.upsertConnection({
            ...connection,
            accessToken: freshTokens.accessToken,
            tokenExpiresAt: new Date(freshTokens.expiresAt * 1000),
          })
        } else if (connection.provider === 'meta' && connection.platform === 'facebook') {
          const freshTokens = await oauth.toLongLived({
            clientId: deps.metaClientId,
            clientSecret: deps.metaClientSecret,
            shortToken: connection.accessToken,
            userId: connection.externalAccountId || '',
          })
          
          const newExpiresAt = freshTokens.expiresAt
            ? new Date(freshTokens.expiresAt * 1000)
            : connection.tokenExpiresAt

          await deps.repository.upsertConnection({
            ...connection,
            accessToken: freshTokens.accessToken,
            tokenExpiresAt: newExpiresAt,
          })
        }
      } catch (error) {
        console.error(`Failed to refresh token for connection ${connection.id}`, error)
        await deps.repository.updateConnectionStatus(connection.id, 'reconnect_required')
      }
    }
  }
}
