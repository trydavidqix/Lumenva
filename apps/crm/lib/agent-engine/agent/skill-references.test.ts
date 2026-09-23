import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGcsGet } = vi.hoisted(() => ({
  mockGcsGet: vi.fn(),
}));

vi.mock('@lumenva/db/storage/gcs', () => ({
  createGcsObjectStore: vi.fn(() => ({ get: mockGcsGet })),
}));

vi.mock('@lumenva/db/gcp/cloud-storage', () => ({
  getGcsBucket: vi.fn(() => ({ file: vi.fn() })),
}));
import { readSkillReference, skillHasReferences } from './skill-references';
import type { LoadedSkill } from './skills';

function skill(overrides: Partial<LoadedSkill> = {}): LoadedSkill {
  return {
    versionId: 'ver-1',
    name: 'frete-atrasado',
    description: 'd',
    body: 'b',
    matcher: { any_keywords: ['frete'] },
    manifest: [{ path: 'refs/politica.md', size: 10, sha256: 'x', kind: 'reference' }],
    ...overrides,
  };
}

beforeEach(() => {
  mockGcsGet.mockReset().mockResolvedValue(new TextEncoder().encode('conteúdo da reference'));
});

describe('skillHasReferences', () => {
  it('true quando o manifesto tem ao menos uma entrada kind:reference', () => {
    expect(skillHasReferences(skill())).toBe(true);
  });

  it('false quando o manifesto só tem assets (ou está vazio)', () => {
    expect(skillHasReferences(skill({ manifest: [{ path: 'img.png', size: 1, sha256: 'x', kind: 'asset' }] }))).toBe(
      false,
    );
    expect(skillHasReferences(skill({ manifest: [] }))).toBe(false);
  });
});

describe('readSkillReference', () => {
  it('skill_not_active quando a skill pedida não está entre as casadas neste turno', async () => {
    const admin = { storage: { from: vi.fn() } } as never;
    const res = await readSkillReference(
      { admin },
      { organizationId: 'org1', matchedSkills: [skill()], skillName: 'outra-skill', refPath: 'refs/politica.md' },
    );
    expect(res).toEqual({
      ok: false,
      error: { code: 'skill_not_active', message: expect.stringContaining('outra-skill') },
    });
  });

  it('reference_not_found quando o path não está no manifesto como reference', async () => {
    const admin = { storage: { from: vi.fn() } } as never;
    const res = await readSkillReference(
      { admin },
      { organizationId: 'org1', matchedSkills: [skill()], skillName: 'frete-atrasado', refPath: 'refs/inexistente.md' },
    );
    expect(res).toEqual({
      ok: false,
      error: { code: 'reference_not_found', message: expect.stringContaining('refs/inexistente.md') },
    });
  });

  it('reference_not_found quando o path existe no manifesto mas como asset (não reference)', async () => {
    const admin = { storage: { from: vi.fn() } } as never;
    const res = await readSkillReference(
      { admin },
      {
        organizationId: 'org1',
        matchedSkills: [skill({ manifest: [{ path: 'img.png', size: 1, sha256: 'x', kind: 'asset' }] })],
        skillName: 'frete-atrasado',
        refPath: 'img.png',
      },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('reference_not_found');
  });

  it('baixa do storage no path {org}/{skill}/{versionId}/{path} e devolve o texto', async () => {
    const download = vi.fn().mockResolvedValue({ data: new Blob(['conteúdo da reference']), error: null });
    const from = vi.fn().mockReturnValue({ download });
    const admin = { storage: { from } } as never;
    const res = await readSkillReference(
      { admin },
      { organizationId: 'org1', matchedSkills: [skill()], skillName: 'frete-atrasado', refPath: 'refs/politica.md' },
    );
    expect(mockGcsGet).toHaveBeenCalledWith({
      provider: 'gcs',
      bucket: 'skill-assets',
      key: 'org1/frete-atrasado/ver-1/refs/politica.md',
    });
    expect(res).toEqual({
      ok: true,
      skill_name: 'frete-atrasado',
      ref_path: 'refs/politica.md',
      content: 'conteúdo da reference',
    });
  });

  it('reference_download_failed quando o storage devolve erro (arquivo órfão/indisponível)', async () => {
    mockGcsGet.mockRejectedValueOnce(new Error('not found'));
    const download = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const from = vi.fn().mockReturnValue({ download });
    const admin = { storage: { from } } as never;
    const res = await readSkillReference(
      { admin },
      { organizationId: 'org1', matchedSkills: [skill()], skillName: 'frete-atrasado', refPath: 'refs/politica.md' },
    );
    expect(res).toEqual({ ok: false, error: { code: 'reference_download_failed', message: expect.any(String) } });
  });
});
