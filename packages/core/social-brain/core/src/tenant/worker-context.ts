import { createHmac, timingSafeEqual } from 'node:crypto'
import { assertTenantContext, type TenantContextData } from './tenant-context'

export interface SignedWorkerTenantContext {
  readonly payload: string
  readonly signature: string
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signWorkerTenantContext(context: TenantContextData, secret: string): SignedWorkerTenantContext {
  if (context.authSource !== 'firebase-worker') throw new Error('TenantContext: worker context required')
  assertTenantContext(context)
  const payload = JSON.stringify(context)
  return { payload, signature: signature(payload, secret) }
}

export function verifyWorkerTenantContext(
  payload: string,
  providedSignature: string,
  secret: string,
): TenantContextData {
  const expected = signature(payload, secret)
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(providedSignature)
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    throw new Error('TenantContext: invalid worker signature')
  }
  let context: TenantContextData
  try {
    context = JSON.parse(payload) as TenantContextData
    assertTenantContext(context)
  } catch {
    throw new Error('TenantContext: invalid worker context')
  }
  if (context.authSource !== 'firebase-worker') throw new Error('TenantContext: worker context required')
  return context
}
