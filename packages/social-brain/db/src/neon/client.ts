import type { NeonExecutor, NeonIdentityContext, NeonQuery, NeonTransaction } from './contract'
import { assertNeonIdentity } from './identity'

export interface NeonClient {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
  withIdentity<Result>(identity: NeonIdentityContext, run: (transaction: NeonTransaction) => Promise<Result>): Promise<Result>
}

export function sql(strings: TemplateStringsArray, ...values: readonly unknown[]): NeonQuery {
  let text = strings[0] ?? ''
  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${strings[index + 1] ?? ''}`
  }
  return { text, values }
}

export function createNeonClient(executor: NeonExecutor): NeonClient {
  return {
    query: (query) => executor.query(query),
    withIdentity: async (identity, run) => {
      assertNeonIdentity(identity)
      return executor.transaction(async (transaction) => {
        await transaction.query({
          text: "select set_config('lumenva.user_id', $1, true)",
          values: [identity.subject],
        })

        if (identity.workspaceId !== undefined) {
          await transaction.query({
            text: "select set_config('app.workspace_id', $1, true)",
            values: [identity.workspaceId],
          })
        }

        if (identity.claims !== undefined) {
          await transaction.query({
            text: "select set_config('request.jwt.claims', $1, true)",
            values: [JSON.stringify(identity.claims)],
          })
        }

        const registeredIdentity = await transaction.query({
          text: 'select user_id from public.lumenva_identities where user_id = public.current_user_id() and active limit 1',
          values: [],
        })
        if (registeredIdentity.length === 0) throw new Error('Neon identity is not registered or active')

        return run(transaction)
      })
    },
  }
}
