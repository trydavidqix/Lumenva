import { createServerClient } from '@supabase/ssr'

import type { Database } from '../types'

export type DbServerClientOptions = NonNullable<Parameters<typeof createServerClient>[2]>

export function createDbServerClient(
  url: string,
  publishableKey: string,
  options: DbServerClientOptions,
) {
  return createServerClient<Database>(url, publishableKey, options)
}
