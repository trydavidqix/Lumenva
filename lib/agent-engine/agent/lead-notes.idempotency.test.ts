import { describe, expect, it, vi } from 'vitest';

import { applySaveLeadNote } from './lead-notes';

interface StoredNote {
  id: string;
  headline: string;
  body: string;
}

function memoryDb() {
  const notes: StoredNote[] = [];
  let inserts = 0;

  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('select id, headline from lead_notes')) {
      return {
        rows: notes.map(({ id, headline }) => ({ id, headline })),
        rowCount: notes.length,
      };
    }

    if (sql.includes('insert into lead_notes')) {
      inserts += 1;
      const id = `note-${inserts}`;
      const headline = String(values?.[3] ?? '');
      const body = String(values?.[4] ?? '');
      notes.push({ id, headline, body });
      return { rows: [{ id, superseded: '0' }], rowCount: 1 };
    }

    throw new Error(`query inesperada no fake: ${sql}`);
  });

  return {
    db: { query } as never,
    read: () => notes,
    insertCount: () => inserts,
  };
}

describe('Agent OS lead note idempotency', () => {
  it('não duplica a mesma nota quando o mesmo side effect é reexecutado no retry do run', async () => {
    const memory = memoryDb();
    const ids = {
      tenantId: 'org-1',
      leadId: 'lead-1',
      idempotencyKey: 'agent-os:run-1:save-lead-note:customer-preference',
    } as any;
    const input = {
      headline: 'Prefere contato à tarde',
      body: 'O lead informou que prefere receber contato depois das 14h.',
    };

    const first = await applySaveLeadNote(
      memory.db,
      ids,
      { budgetTokens: 10_000 },
      input,
    );
    const replay = await applySaveLeadNote(
      memory.db,
      ids,
      { budgetTokens: 10_000 },
      input,
    );

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok) throw new Error('esperava duas respostas ok');

    expect(replay.noteId).toBe(first.noteId);
    expect(memory.insertCount()).toBe(1);
    expect(memory.read()).toHaveLength(1);
  });
});
