import { TenantContext, type TenantContextData } from '@lumenva/core'
import type { NeonQuery, NeonTransaction } from '../neon/contract'

interface QueryExecutor {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
  transaction?<Result>(run: (transaction: NeonTransaction) => Promise<Result>): Promise<Result>
}

export function requireTenantContext(): TenantContextData {
  return TenantContext.current()
}

function scopedQuery(query: NeonQuery, context: TenantContextData): NeonQuery {
  const text = query.text.trim()
  const command = text.match(/^(select|insert|update|delete)\b/i)?.[1].toLowerCase()
  if (!command) throw new Error('TenantContext: unsupported SQL command')

  const values = [...query.values]
  const organizationAssignments = [...text.matchAll(/\borganization_id\s*=\s*\$(\d+)/gi)]
  const whereOffset = text.search(/\bwhere\b/i)
  const hasOrganizationPredicate = organizationAssignments.some(
    (match) => whereOffset >= 0 && (match.index ?? -1) > whereOffset,
  )

  if (command === 'insert') {
    const insert = text.match(/\(([^()]*)\)\s*values\s*\(([^()]*)\)/i)
    const columns = insert?.[1]?.split(',').map((column) => column.trim().toLowerCase())
    const insertValues = insert?.[2]?.split(',').map((value) => value.trim())
    const organizationColumn = columns?.indexOf('organization_id') ?? -1
    const organizationValue = organizationColumn >= 0 ? insertValues?.[organizationColumn] : undefined
    const parameter = organizationValue?.match(/^\$(\d+)$/)?.[1]
    if (!parameter) {
      throw new Error('TenantContext: INSERT must include parameterized organization_id')
    }
    values[Number(parameter) - 1] = context.organizationId
    return { text, values }
  }

  for (const match of organizationAssignments) {
    const parameter = Number(match[1])
    if (!Number.isInteger(parameter) || parameter < 1 || parameter > values.length) {
      throw new Error('TenantContext: organization_id parameter is invalid')
    }
    values[parameter - 1] = context.organizationId
  }

  if (hasOrganizationPredicate) return { text, values }

  const parameter = values.length + 1
  values.push(context.organizationId)
  const predicate = `organization_id = $${parameter}`
  const clauseOffset = text.search(/\b(order\s+by|group\s+by|limit|offset|returning|for\s+update)\b/i)
  const insertion = clauseOffset >= 0 ? clauseOffset : text.length
  const head = text.slice(0, insertion).trimEnd()
  const tail = text.slice(insertion).trim()
  const separator = whereOffset >= 0 ? ' AND ' : ' WHERE '
  return { text: `${head}${separator}${predicate}${tail ? ` ${tail}` : ''}`, values }
}

function sessionSettings(context: TenantContextData): NeonQuery {
  return {
    text: 'select set_config($1, $2, true), set_config($3, $4, true), set_config($5, $6, true)',
    values: [
      'app.user_id', context.userId,
      'app.organization_id', context.organizationId,
      'app.role', context.role,
    ],
  }
}

export function createTenantQuery(executor: QueryExecutor) {
  return {
    async run<Row = Record<string, unknown>>(query: NeonQuery) {
      const context = requireTenantContext()
      return executor.query<Row>(scopedQuery(query, context))
    },
    transaction<Result>(run: (transaction: NeonTransaction) => Promise<Result>) {
      const context = requireTenantContext()
      if (!executor.transaction) throw new Error('TenantContext: transaction executor required')
      return executor.transaction(async (transaction) => {
        await transaction.query(sessionSettings(context))
        return run({
          query: <Row = Record<string, unknown>>(query: NeonQuery) =>
            transaction.query<Row>(scopedQuery(query, context)),
        })
      })
    },
  }
}
