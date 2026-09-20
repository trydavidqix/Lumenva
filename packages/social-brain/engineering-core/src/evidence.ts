import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GateResult } from './model.ts'

const SECRET_PATTERNS = [
  /(authorization\s*:\s*bearer\s+)[^\s,;]+/gi,
  /(\bbearer\s+)[^\s,;]+/gi,
  /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[=:]\s*["']?)[^\s,;"']+/gi,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+/g,
  /\bgithub_pat_[A-Za-z0-9_]+/g,
  /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bsk-[A-Za-z0-9_-]+/g,
]

export function redactSecrets(value: string, secrets: readonly string[] = []): string {
  let result = value
  for (const secret of secrets) {
    if (secret.length >= 4) result = result.split(secret).join('[REDACTED]')
  }
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, (...matches) => matches[1] && typeof matches[1] === 'string' && (matches[1].toLowerCase().includes('bearer') || matches[1].includes('=') || matches[1].includes(':')) ? `${matches[1]}[REDACTED]` : '[REDACTED]')
  return result
}

export function summarizeOutput(value: string, secrets: readonly string[] = [], maxLength = 800): string {
  const safe = redactSecrets(value, secrets).replace(/\s+/g, ' ').trim()
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 3)}...` : safe
}

export async function appendEvidence(path: string, result: GateResult, secrets: readonly string[] = []): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const safe: GateResult = { ...result, gate: redactSecrets(result.gate, secrets), command: result.command.map(value => redactSecrets(value, secrets)), timestamp: redactSecrets(result.timestamp, secrets), branch: redactSecrets(result.branch, secrets), commit_sha: redactSecrets(result.commit_sha, secrets), summary: summarizeOutput(result.summary, secrets), ...(result.spawn_error === undefined ? {} : { spawn_error: redactSecrets(result.spawn_error, secrets) }) }
  await appendFile(path, `${JSON.stringify(safe)}\n`, { encoding: 'utf8', mode: 0o600 })
}
