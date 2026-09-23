import { Event } from '@sentry/types';

const SECRETS_KEYS = ['authorization', 'cookie', 'password', 'token', 'api_key', 'secret'];
const PII_KEYS = ['email', 'name', 'phone', 'address'];

function deepScrub(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepScrub);
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    let isSecret = false;
    for (const secretKey of SECRETS_KEYS) {
      if (lowerKey.includes(secretKey)) {
        isSecret = true;
        break;
      }
    }

    let isPii = false;
    for (const piiKey of PII_KEYS) {
      if (lowerKey.includes(piiKey)) {
        isPii = true;
        break;
      }
    }

    if (isSecret) {
      scrubbed[key] = '[Filtered]';
    } else if (isPii) {
      scrubbed[key] = '[Filtered PII]';
    } else {
      scrubbed[key] = deepScrub(value);
    }
  }
  return scrubbed;
}

export function scrubEvent(event: Event): Event | null {
  if (!event) return event;

  const clone = JSON.parse(JSON.stringify(event)) as Event;

  if (clone.request) {
    if (clone.request.headers) {
      clone.request.headers = deepScrub(clone.request.headers) as Record<string, string>;
    }
    if (clone.request.data && typeof clone.request.data === 'object') {
      clone.request.data = deepScrub(clone.request.data);
    }
  }

  if (clone.contexts) {
    clone.contexts = deepScrub(clone.contexts) as Event['contexts'];
  }

  return clone;
}
