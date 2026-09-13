import { describe, expect, it, vi } from 'vitest';

import { MemoryGateway, type MemoryQuery } from './memory-gateway';

const query = (text: string, kind?: MemoryQuery['kind']): MemoryQuery => ({ text, ...(kind === undefined ? {} : { kind }) });

describe('MemoryGateway', () => {
  it('routes semantic, episodic and procedural queries to one subsystem each', async () => {
    const semantic = vi.fn(async () => ['meaning']);
    const episodic = vi.fn(async () => ['event']);
    const procedural = vi.fn(async () => ['steps']);
    const gateway = new MemoryGateway({ semantic, episodic, procedural });

    await expect(gateway.query(query('what does this contract mean?'))).resolves.toEqual(['meaning']);
    await expect(gateway.query(query('what happened in the last session?'))).resolves.toEqual(['event']);
    await expect(gateway.query(query('how do I deploy this?'))).resolves.toEqual(['steps']);

    expect(semantic).toHaveBeenCalledTimes(1);
    expect(episodic).toHaveBeenCalledTimes(1);
    expect(procedural).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit memory kind and does not call another backend', async () => {
    const semantic = vi.fn(async () => ['meaning']);
    const episodic = vi.fn(async () => ['event']);
    const procedural = vi.fn(async () => ['steps']);
    const gateway = new MemoryGateway({ semantic, episodic, procedural });

    await expect(gateway.query(query('how did the incident happen?', 'episodic'))).resolves.toEqual(['event']);
    expect(episodic).toHaveBeenCalledOnce();
    expect(semantic).not.toHaveBeenCalled();
    expect(procedural).not.toHaveBeenCalled();
  });
});
