import { describe, it, expect, beforeEach } from 'vitest';
import { SocialIdentityAdapter } from './adapter';
import type { ContactRegistry, SocialIdentityRepository, SocialIdentity, UpsertIdentityInput } from './types';

class FakeSocialIdentityRepository implements SocialIdentityRepository {
  private data: SocialIdentity[] = [];

  async findByKey(
    organizationId: string,
    provider: string,
    providerAccountId: string,
    externalId: string
  ): Promise<SocialIdentity | null> {
    return (
      this.data.find(
        (i) =>
          i.organizationId === organizationId &&
          i.provider === provider &&
          i.providerAccountId === providerAccountId &&
          i.externalId === externalId
      ) || null
    );
  }

  async save(identity: SocialIdentity): Promise<SocialIdentity> {
    const idx = this.data.findIndex((i) => i.id === identity.id);
    if (idx !== -1) {
      this.data[idx] = identity;
    } else {
      this.data.push(identity);
    }
    return identity;
  }
}

class FakeContactRegistry implements ContactRegistry {
  public contacts: { id: string; organizationId: string; name?: string; email?: string }[] = [];
  public createdCount = 0;

  async createContact(input: {
    organizationId: string;
    source: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    this.createdCount++;
    const id = `contact-${this.createdCount}`;
    this.contacts.push({ id, organizationId: input.organizationId, name: input.name, email: input.email });
    return id;
  }
}

describe('SocialIdentityAdapter', () => {
  let repository: FakeSocialIdentityRepository;
  let registry: FakeContactRegistry;
  let adapter: SocialIdentityAdapter;

  beforeEach(() => {
    repository = new FakeSocialIdentityRepository();
    registry = new FakeContactRegistry();
    adapter = new SocialIdentityAdapter(repository, registry);
  });

  it('creates a new identity and links it to a new contact when unseen', async () => {
    const input: UpsertIdentityInput = {
      organizationId: 'org-1',
      provider: 'instagram',
      providerAccountId: 'acc-1',
      externalId: 'ext-123',
      unverifiedName: 'Jane Doe',
    };

    const result = await adapter.upsertIdentity(input);

    expect(result.organizationId).toBe('org-1');
    expect(result.contactId).toBe('contact-1');
    expect(registry.createdCount).toBe(1);
    expect(registry.contacts[0]?.name).toBe('Jane Doe (Não verificado)');
  });

  it('replay of event is idempotent (does not duplicate identity or contact)', async () => {
    const input: UpsertIdentityInput = {
      organizationId: 'org-1',
      provider: 'instagram',
      providerAccountId: 'acc-1',
      externalId: 'ext-123',
    };

    const r1 = await adapter.upsertIdentity(input);
    const r2 = await adapter.upsertIdentity(input);

    expect(r1.id).toBe(r2.id);
    expect(r1.contactId).toBe(r2.contactId);
    expect(registry.createdCount).toBe(1); // Didn't create a second contact
  });

  it('same person in different tenants/organizations do not collide', async () => {
    const input1: UpsertIdentityInput = {
      organizationId: 'org-A',
      provider: 'instagram',
      providerAccountId: 'acc-1',
      externalId: 'ext-123',
    };

    const input2: UpsertIdentityInput = {
      organizationId: 'org-B',
      provider: 'instagram',
      providerAccountId: 'acc-2',
      externalId: 'ext-123',
    };

    const r1 = await adapter.upsertIdentity(input1);
    const r2 = await adapter.upsertIdentity(input2);

    expect(r1.id).not.toBe(r2.id);
    expect(r1.contactId).not.toBe(r2.contactId);
    expect(registry.createdCount).toBe(2);
  });

  it('different provider accounts in same tenant do not collide by default', async () => {
    const input1: UpsertIdentityInput = {
      organizationId: 'org-1',
      provider: 'instagram',
      providerAccountId: 'brand-A',
      externalId: 'ext-123',
    };

    const input2: UpsertIdentityInput = {
      organizationId: 'org-1',
      provider: 'instagram',
      providerAccountId: 'brand-B',
      externalId: 'ext-123',
    };

    const r1 = await adapter.upsertIdentity(input1);
    const r2 = await adapter.upsertIdentity(input2);

    expect(r1.id).not.toBe(r2.id);
    expect(r1.contactId).not.toBe(r2.contactId);
    expect(registry.createdCount).toBe(2);
  });
});
