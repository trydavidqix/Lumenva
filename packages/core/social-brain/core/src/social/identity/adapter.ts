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
    const orgId = (input.organizationId || '').trim();
    if (!orgId) {
      throw new Error('organizationId is required and must be provided by a trusted server context');
    }

    const key = {
      organizationId: orgId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      externalId: input.externalId,
    };

    return this.repository.upsertAtomic(key, async () => {
      // Identity was not found, so we create a new CRM contact first
      let displayName = input.unverifiedName;
      if (displayName) {
        displayName = `${displayName} (Não verificado)`;
      } else {
        displayName = 'Contato Desconhecido (Social)';
      }

      const contactId = await this.contactRegistry.createContact({
        organizationId: orgId,
        source: `social_${input.provider}`,
        name: displayName,
        email: input.unverifiedEmail, // Will likely not merge automatically by rule
        metadata: {
          socialProvider: input.provider,
          socialProviderAccountId: input.providerAccountId,
          socialExternalId: input.externalId,
        },
      });

      // Construct and return the new identity
      return {
        id: crypto.randomUUID(),
        organizationId: orgId,
        contactId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        externalId: input.externalId,
        profileData: input.profileData || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }
}
