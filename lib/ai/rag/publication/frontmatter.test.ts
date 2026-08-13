import { describe, it, expect } from 'vitest';
import {
  PublicationFrontmatterSchema,
  assertPublishableDocument,
  validateFrontmatter,
} from './frontmatter';

const validUUID = '00000000-0000-4000-8000-000000000001';
const validFrontmatter = {
  status: 'PUBLISHED' as const,
  organization_id: validUUID,
  agent_id: '00000000-0000-4000-8000-000000000002',
  title: 'Política de Reembolso',
  source_id: 'refund-policy',
  version: 3,
  published_at: '2026-08-10T12:00:00Z',
};

describe('PublicationFrontmatterSchema', () => {
  describe('valid frontmatter', () => {
    it('accepts well-formed frontmatter with PUBLISHED status', () => {
      const result = PublicationFrontmatterSchema.safeParse(validFrontmatter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PUBLISHED');
        expect(result.data.organization_id).toBe(validUUID);
        expect(result.data.version).toBe(3);
      }
    });

    it('accepts all valid status values: DRAFT, REVIEW, PUBLISHED, ARCHIVED', () => {
      const statuses = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
      for (const status of statuses) {
        const result = PublicationFrontmatterSchema.safeParse({
          ...validFrontmatter,
          status,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(status);
        }
      }
    });

    it('accepts version 1', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(1);
      }
    });

    it('accepts large version numbers', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: 9999,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(9999);
      }
    });

    it('accepts ISO-8601 UTC dates', () => {
      const testDates = [
        '2026-08-10T12:00:00Z',
        '2020-01-01T00:00:00Z',
        '2099-12-31T23:59:59Z',
      ];
      for (const date of testDates) {
        const result = PublicationFrontmatterSchema.safeParse({
          ...validFrontmatter,
          published_at: date,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.published_at).toBe(date);
        }
      }
    });
  });

  describe('rejects missing required fields', () => {
    it('rejects missing status', () => {
      const { status, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing organization_id', () => {
      const { organization_id, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing agent_id', () => {
      const { agent_id, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing title', () => {
      const { title, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing source_id', () => {
      const { source_id, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing version', () => {
      const { version, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing published_at', () => {
      const { published_at, ...rest } = validFrontmatter;
      const result = PublicationFrontmatterSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('rejects invalid status values', () => {
    it('rejects status not in enum', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        status: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects lowercase status', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        status: 'published',
      });
      expect(result.success).toBe(false);
    });

    it('rejects null status', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        status: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rejects invalid UUIDs', () => {
    it('rejects invalid organization_id', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        organization_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid agent_id', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        agent_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty string as UUID', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        organization_id: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects null as UUID', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        organization_id: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rejects empty or invalid title', () => {
    it('rejects empty title', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects title with only whitespace', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        title: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects null title', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        title: null,
      });
      expect(result.success).toBe(false);
    });

    it('accepts title with special characters', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        title: 'Política de Reembolso - v2.0 (Versão Atualizada)',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejects empty or invalid source_id', () => {
    it('rejects empty source_id', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        source_id: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects source_id with only whitespace', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        source_id: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects null source_id', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        source_id: null,
      });
      expect(result.success).toBe(false);
    });

    it('accepts source_id with hyphens and underscores', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        source_id: 'refund-policy_v2',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejects invalid version', () => {
    it('rejects version 0', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative version', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects float version', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: 3.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects null version', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        version: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rejects invalid dates', () => {
    it('rejects invalid date format', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        published_at: '2026-08-10',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO-8601 date', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        published_at: '08/10/2026',
      });
      expect(result.success).toBe(false);
    });

    it('rejects null date', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        published_at: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid date string', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        published_at: 'not a date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('strict mode rejects unknown keys', () => {
    it('rejects unknown keys in strict mode', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        unknown_key: 'value',
      });
      expect(result.success).toBe(false);
    });

    it('rejects multiple unknown keys', () => {
      const result = PublicationFrontmatterSchema.safeParse({
        ...validFrontmatter,
        extra1: 'value1',
        extra2: 'value2',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('validateFrontmatter', () => {
  it('returns parsed frontmatter on success', () => {
    const result = validateFrontmatter(validFrontmatter);
    expect(result).toBeTruthy();
    expect(result?.status).toBe('PUBLISHED');
    expect(result?.organization_id).toBe(validUUID);
  });

  it('returns null on validation failure', () => {
    const result = validateFrontmatter({
      ...validFrontmatter,
      status: 'INVALID',
    });
    expect(result).toBeNull();
  });

  it('returns null when required field is missing', () => {
    const { status, ...rest } = validFrontmatter;
    const result = validateFrontmatter(rest);
    expect(result).toBeNull();
  });
});

describe('assertPublishableDocument', () => {
  it('accepts PUBLISHED status', () => {
    const result = assertPublishableDocument({
      ...validFrontmatter,
      status: 'PUBLISHED',
    });
    expect(result).toBeTruthy();
    expect(result.status).toBe('PUBLISHED');
  });

  it('rejects DRAFT status', () => {
    expect(() => {
      assertPublishableDocument({
        ...validFrontmatter,
        status: 'DRAFT',
      });
    }).toThrow();
  });

  it('rejects REVIEW status', () => {
    expect(() => {
      assertPublishableDocument({
        ...validFrontmatter,
        status: 'REVIEW',
      });
    }).toThrow();
  });

  it('rejects ARCHIVED status', () => {
    expect(() => {
      assertPublishableDocument({
        ...validFrontmatter,
        status: 'ARCHIVED',
      });
    }).toThrow();
  });

  it('throws on invalid frontmatter', () => {
    expect(() => {
      assertPublishableDocument({
        ...validFrontmatter,
        version: 0,
      });
    }).toThrow();
  });

  it('throws on missing required field', () => {
    const { title, ...rest } = validFrontmatter;
    expect(() => {
      assertPublishableDocument(rest);
    }).toThrow();
  });
});
