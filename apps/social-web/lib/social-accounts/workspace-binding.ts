const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const WORKSPACE_BINDING_CONFIG_ERROR =
  'A ligação entre este workspace e o BrightBean ainda não está configurada.'
export const WORKSPACE_BINDING_MISMATCH_ERROR =
  'Este workspace não está autorizado para a integração de contas sociais.'

export type SocialBrainWorkspaceBindingEnv = Record<string, string | undefined>

export function validateSocialBrainWorkspaceBinding(
  ownerWorkspaceId: string,
  env: SocialBrainWorkspaceBindingEnv,
): { ok: true; workspaceId: string } | { ok: false; message: string } {
  const ownerId = ownerWorkspaceId.trim()
  const configuredId = env.SOCIAL_BRAIN_WORKSPACE_ID?.trim() ?? ''

  if (!isUuid(ownerId) || !isUuid(configuredId)) {
    return { ok: false, message: WORKSPACE_BINDING_CONFIG_ERROR }
  }

  if (ownerId !== configuredId) {
    return { ok: false, message: WORKSPACE_BINDING_MISMATCH_ERROR }
  }

  return { ok: true, workspaceId: ownerId }
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}
