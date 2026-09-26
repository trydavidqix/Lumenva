export type WorkspaceOwnerRecord = {
  id: string
  ownerUserId: string
}

export type OwnerContext = {
  userId: string
  workspaceId: string
}

export type OwnerAuthErrorCode = 'unauthenticated' | 'forbidden'

export class OwnerAuthError extends Error {
  readonly code: OwnerAuthErrorCode

  constructor(code: OwnerAuthErrorCode) {
    super(code === 'unauthenticated' ? 'Authentication required' : 'Owner access required')
    this.name = 'OwnerAuthError'
    this.code = code
  }
}

export type RequireOwnerDependencies = {
  getAuthenticatedUserId: () => Promise<string | null>
  findWorkspaceByOwnerUserId: (userId: string) => Promise<WorkspaceOwnerRecord | null>
}

export async function requireOwner(dependencies: RequireOwnerDependencies): Promise<OwnerContext> {
  const userId = await dependencies.getAuthenticatedUserId()

  if (!userId) {
    throw new OwnerAuthError('unauthenticated')
  }

  const workspace = await dependencies.findWorkspaceByOwnerUserId(userId)

  if (!workspace || workspace.ownerUserId !== userId) {
    throw new OwnerAuthError('forbidden')
  }

  return {
    userId,
    workspaceId: workspace.id,
  }
}
