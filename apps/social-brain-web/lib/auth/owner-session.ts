export type OwnerWorkspace = {
  id: string
  name: string
  ownerUserId: string
}

export type OwnerSessionErrorCode = 'INVALID_CREDENTIALS' | 'NOT_OWNER'

export class OwnerSessionError extends Error {
  constructor(
    public readonly code: OwnerSessionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'OwnerSessionError'
  }
}

type AuthGateway = {
  signInWithPassword(email: string, password: string): Promise<string | null>
  signOut(): Promise<void>
}

type WorkspaceGateway = {
  findOwnedWorkspace(userId: string): Promise<OwnerWorkspace | null>
}

export async function loginOwner(
  dependencies: { auth: AuthGateway; workspaces: WorkspaceGateway },
  input: { email: string; password: string },
): Promise<OwnerWorkspace> {
  const userId = await dependencies.auth.signInWithPassword(input.email, input.password)

  if (!userId) {
    throw new OwnerSessionError('INVALID_CREDENTIALS', 'Credenciais inválidas.')
  }

  const workspace = await dependencies.workspaces.findOwnedWorkspace(userId)

  if (!workspace) {
    await dependencies.auth.signOut()
    throw new OwnerSessionError('NOT_OWNER', 'Utilizador sem acesso ao workspace owner.')
  }

  return workspace
}
