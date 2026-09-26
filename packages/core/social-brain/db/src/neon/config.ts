import type { NeonConnectionContract, NeonPooling, NeonRuntime } from './contract'

export interface NeonConfigInput {
  readonly databaseUrl?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly runtime?: NeonRuntime
}

const databaseUrlPattern = /^postgres(?:ql)?:\/\/[^\s]+$/i

function detectPooling(databaseUrl: string | undefined): NeonPooling {
  if (!databaseUrl) return 'unknown'

  try {
    const hostname = new URL(databaseUrl).hostname
    return hostname.split('.')[0]?.endsWith('-pooler') ? 'pooled' : 'direct'
  } catch {
    return 'unknown'
  }
}

export function resolveNeonConnection(input: NeonConfigInput = {}): NeonConnectionContract {
  const databaseUrl = input.databaseUrl ?? input.env?.DATABASE_URL
  const runtime = input.runtime ?? 'unknown'

  if (databaseUrl !== undefined && !databaseUrlPattern.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL')
  }

  return {
    configured: databaseUrl !== undefined,
    runtime,
    pooling: detectPooling(databaseUrl),
  }
}

export function isPooledNeonUrl(databaseUrl: string): boolean {
  return detectPooling(databaseUrl) === 'pooled'
}
