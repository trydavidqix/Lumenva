export type MemoryKind = 'semantic' | 'episodic' | 'procedural';

export interface MemoryQuery {
  text: string;
  kind?: MemoryKind;
}

export type MemoryBackend<T> = (query: MemoryQuery) => Promise<T>;

export interface MemoryBackends<T> {
  semantic: MemoryBackend<T>;
  episodic: MemoryBackend<T>;
  procedural: MemoryBackend<T>;
}

/** Single routing seam for memory retrieval; backends own their retrieval logic. */
export class MemoryGateway<T> {
  constructor(private readonly backends: MemoryBackends<T>) {}

  async query(input: MemoryQuery): Promise<T> {
    const kind = input.kind ?? classifyQuery(input.text);
    return this.backends[kind](input);
  }
}

function classifyQuery(text: string): MemoryKind {
  const normalized = text.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(how|como|passos|procedimento|configurar|fazer)\b/u.test(normalized)) return 'procedural';
  if (/\b(when|quando|ontem|historico|aconteceu|ultima sessao|last session)\b/u.test(normalized)) return 'episodic';
  return 'semantic';
}
