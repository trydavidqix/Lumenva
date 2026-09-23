export class SecretResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretResolutionError';
  }
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearSecretCache() {
  cache.clear();
}

export async function resolveSecret(name: string): Promise<string> {
  const now = Date.now();

  // Check cache first
  const cached = cache.get(name);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // Fetch from env placeholder for F8-J2
  // We expect LUMENVA_SECRET_<NAME>
  const envKey = `LUMENVA_SECRET_${name}`;
  const value = process.env[envKey];

  if (!value) {
    throw new SecretResolutionError(`Failed to resolve secret: ${name}. Secret does not exist or has no value.`);
  }

  cache.set(name, {
    value,
    expiresAt: now + CACHE_TTL_MS
  });

  return value;
}
