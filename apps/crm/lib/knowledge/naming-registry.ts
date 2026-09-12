export type NamingEntry = string;

/** Naming policy: trim, Unicode NFKC compatibility-normalize, lowercase, remove separators/punctuation. */
export const normalizeComponentName = (name: string): string =>
  name.trim().normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Registry for near-duplicate names, shared by components, skills and agents. */
export class NamingRegistry {
  private readonly entries = new Map<string, NamingEntry>();

  register(name: string): void {
    const displayName = name.trim();
    const key = normalizeComponentName(displayName);
    if (key.length === 0) throw new Error('component name is required');
    if (this.entries.has(key)) {
      throw new Error(`similar component name already registered: ${displayName}`);
    }
    this.entries.set(key, displayName);
  }

  has(name: string): boolean {
    return this.entries.has(normalizeComponentName(name));
  }

  list(): string[] {
    return [...this.entries.values()];
  }
}
