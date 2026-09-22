const SECRET_PATTERNS=[/(?:sk|pk|rk)_[A-Za-z0-9_-]{16,}/g,/Bearer\s+[A-Za-z0-9._-]+/gi,/(?:password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi];
export function redactSecrets(value:string):string{return SECRET_PATTERNS.reduce((text,p)=>text.replace(p,'[REDACTED]'),value)}
export function sanitizeTrace<T>(value:T):T{return JSON.parse(redactSecrets(JSON.stringify(value))) as T}
