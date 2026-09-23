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

export function redact(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Error) {
    // Serialize Error objects properly
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      ...redact(Object.assign({}, obj)), // handle any other properties attached to error
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item));
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
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
