import type {
  SocialIdentity,
  UpsertIdentityInput,
  ContactRegistry,
  SocialIdentityRepository,
} from './types';

export class SocialIdentityAdapter {
  constructor(
    private readonly repository: SocialIdentityRepository,
    private readonly contactRegistry: ContactRegistry
  ) {}

  /**
   * Processa uma identidade externa, ligando a um contato canônico no CRM,
   * respeitando as regras de idempotência, não-colisão multi-tenant, e deduplicação.
   */
  async upsertIdentity(input: UpsertIdentityInput): Promise<SocialIdentity> {
    throw new Error('Not implemented');
  }
}
