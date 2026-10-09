/**
 * Tipos fundamentais para a identidade externa em redes sociais, e como
 * elas se vinculam ao domínio canônico do CRM.
 */

/**
 * Representa um perfil em rede social (Identidade Externa).
 * O escopo obrigatório para deduplicação é `[organizationId, provider, providerAccountId, externalId]`.
 */
export interface SocialIdentity {
  /** UUID da identidade (gerado) */
  id: string;
  /** UUID do tenant. É a fronteira final de isolamento. */
  organizationId: string;
  /** UUID do contato canônico no CRM (ou null se ainda não estiver vinculado/criado). */
  contactId: string | null;
  /** O provedor externo, e.g. 'instagram', 'facebook'. */
  provider: string;
  /** A conta oficial (no nosso sistema) que recebeu o contato. */
  providerAccountId: string;
  /** O ID do usuário na rede social. */
  externalId: string;
  /** Metadados atualizados/extraídos no perfil (nome, username, foto) */
  profileData: Record<string, unknown>;
  /** Timestamps ISO 8601 UTC */
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload de entrada para upsert de uma SocialIdentity e/ou criação de Contato.
 * IMPORTANTE: `organizationId` deve sempre vir do contexto autenticado server-side (CRM).
 * O adapter confia que esse valor já foi validado e que o actor pertence a este tenant.
 */
export interface UpsertIdentityInput {
  organizationId: string;
  provider: string;
  providerAccountId: string;
  externalId: string;
  profileData?: Record<string, unknown>;
  /** Opcional: Se for fornecido um nome não-verificado via rede social. */
  unverifiedName?: string;
  /** Opcional: Se for fornecido um email, que a princípio não deve disparar merge automático. */
  unverifiedEmail?: string;
}

/**
 * Contrato de uma interface abstrata que conecta o domínio Social ao CRM.
 * Evita acoplamento direto com as tabelas de banco em pacotes onde schema não está aprovado.
 */
export interface ContactRegistry {
  /**
   * Cria um contato no tenant e retorna o UUID gerado.
   */
  createContact(input: {
    organizationId: string;
    source: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;
}

/**
 * Armazenamento abstrato das identidades (para possibilitar TDD de regras complexas
 * sem acoplar-se ao SQLite local).
 */
export interface SocialIdentityRepository {
  findByKey(
    organizationId: string,
    provider: string,
    providerAccountId: string,
    externalId: string
  ): Promise<SocialIdentity | null>;

  save(identity: SocialIdentity): Promise<SocialIdentity>;

  /**
   * Resolve a idempotência em caso de concorrência.
   * Tenta encontrar e, se não encontrar, chama o fallback de criação atômica.
   * Deve ser encapsulado no banco (ex: ON CONFLICT DO NOTHING RETURNING).
   */
  upsertAtomic(
    key: { organizationId: string; provider: string; providerAccountId: string; externalId: string },
    factory: () => Promise<SocialIdentity>
  ): Promise<SocialIdentity>;
}
