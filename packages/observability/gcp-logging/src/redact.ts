export const SENSITIVE_KEYS = [
  'password',
  'api_key',
  'apikey',
  'token',
  'authorization',
  'cookie',
  'secret',
  'cpf',
  'email',
  'phone',
  'telefone',
  'cpf_cnpj'
];

const REDACTED_STRING = '[REDACTED]';

export function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Error) {
    // Serialize Error objects properly
    const additionalProperties = redact(Object.assign({}, obj));
    const additional =
      typeof additionalProperties === 'object' &&
      additionalProperties !== null &&
      !Array.isArray(additionalProperties)
        ? additionalProperties
        : {};
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      ...additional, // handle any other properties attached to error
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if the key matches any sensitive keys
    const isSensitive = SENSITIVE_KEYS.some(
      (sensitiveKey) => lowerKey === sensitiveKey || lowerKey.includes(sensitiveKey)
    );

    if (isSensitive) {
      result[key] = REDACTED_STRING;
    } else {
      result[key] = typeof value === 'object' && value !== null ? redact(value) : value;
    }
  }

  return result;
}
