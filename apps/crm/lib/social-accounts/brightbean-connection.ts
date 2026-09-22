export type BrightBeanConnectionConfig = {
  baseUrl: string
  workspaceId: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildBrightBeanConnectionUrl(config: BrightBeanConnectionConfig): string {
  const workspaceId = config.workspaceId.trim()
  if (!workspaceId) throw new Error('BrightBean workspace id is required')
  if (!UUID_PATTERN.test(workspaceId)) throw new Error('BrightBean workspace id must be a UUID')

  let baseUrl: URL
  try {
    baseUrl = new URL(config.baseUrl)
  } catch {
    throw new Error('BrightBean base URL is invalid')
  }

  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('BrightBean base URL must use http or https')
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error('BrightBean base URL cannot contain credentials')
  }

  const normalizedPath = baseUrl.pathname.replace(/\/+$/, '')
  baseUrl.pathname = `${normalizedPath}/social-accounts/${encodeURIComponent(workspaceId)}/connect/`
  baseUrl.search = ''
  baseUrl.hash = ''
  return baseUrl.toString()
}
