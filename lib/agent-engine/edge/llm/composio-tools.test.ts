/**
 * O que este teste protege: **sem `COMPOSIO_API_KEY` ou sem `composio_apps`,
 * zero chamada à Composio — e uma falha da Composio nunca derruba o turno.**
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refs = vi.hoisted(() => ({
  toolsMock: vi.fn(async () => ({ GOOGLECALENDAR_CREATE_EVENT: { description: 'cria evento' } })),
  createMock: vi.fn(async (_userId: string, _config: unknown) => ({ tools: refs.toolsMock })),
}));

vi.mock('@composio/core', () => ({
  Composio: class {
    create = refs.createMock;
  },
  SessionPreset: { DIRECT_TOOLS: 'direct_tools' },
}));
vi.mock('@composio/vercel', () => ({ VercelProvider: vi.fn() }));

import { buildComposioTurnTools } from './composio-tools';

const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Parameters<
  typeof buildComposioTurnTools
>[3];

beforeEach(() => {
  refs.createMock.mockClear();
  refs.toolsMock.mockClear();
});

describe('buildComposioTurnTools', () => {
  it('SEM api key, devolve null sem chamar a Composio', async () => {
    const result = await buildComposioTurnTools('', 'org-1', ['GOOGLECALENDAR_CREATE_EVENT'], fakeLog);
    expect(result).toBeNull();
    expect(refs.createMock).not.toHaveBeenCalled();
  });

  it('SEM tool slugs habilitados, devolve null sem chamar a Composio', async () => {
    const result = await buildComposioTurnTools('key-123', 'org-1', [], fakeLog);
    expect(result).toBeNull();
    expect(refs.createMock).not.toHaveBeenCalled();
  });

  it('COM key e tool slugs, cria sessão filtrada por toolkit+tool específica e devolve as tools', async () => {
    const result = await buildComposioTurnTools(
      'key-123',
      'org-1',
      ['GOOGLECALENDAR_CREATE_EVENT', 'GOOGLECALENDAR_FIND_FREE_SLOTS', 'GMAIL_SEND_EMAIL'],
      fakeLog,
    );
    expect(refs.createMock).toHaveBeenCalledWith('org-1', {
      toolkits: ['googlecalendar', 'gmail'],
      tools: {
        googlecalendar: ['GOOGLECALENDAR_CREATE_EVENT', 'GOOGLECALENDAR_FIND_FREE_SLOTS'],
        gmail: ['GMAIL_SEND_EMAIL'],
      },
      sessionPreset: 'direct_tools',
    });
    expect(result?.toolIds).toEqual(['GOOGLECALENDAR_CREATE_EVENT']);
  });

  it('se a Composio falhar, devolve null e loga — nunca lança', async () => {
    refs.createMock.mockRejectedValueOnce(new Error('composio fora do ar'));
    const result = await buildComposioTurnTools('key-123', 'org-1', ['GOOGLECALENDAR_CREATE_EVENT'], fakeLog);
    expect(result).toBeNull();
    expect(fakeLog.error).toHaveBeenCalledWith(
      'tools Composio não montadas — turno segue sem elas',
      expect.objectContaining({ error: expect.stringContaining('composio fora do ar') }),
    );
  });
});
