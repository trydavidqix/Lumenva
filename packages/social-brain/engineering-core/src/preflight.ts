import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
export type EnvironmentStatus = 'PRESENT' | 'MISSING' | 'VALID_SHAPE' | 'INVALID_SHAPE'
export function resolvePreflightStatus(result: 'PASS' | 'FAIL' | 'NOT_PROVEN'): 'PASS' | 'FAIL' | 'NOT_PROVEN' { return result }
export function checkEnvironmentVariables(values: Record<string, string | undefined>, requirements: Record<string, 'present' | 'url' | 'key-shape'>): Array<{ name: string; status: EnvironmentStatus }> {
  return Object.entries(requirements).map(([name, rule]) => {
    const value = values[name]
    if (!value) return { name, status: 'MISSING' }
    if (rule === 'present') return { name, status: 'PRESENT' }
    if (rule === 'url') return { name, status: /^https?:\/\/[^\s]+$/.test(value) ? 'VALID_SHAPE' : 'INVALID_SHAPE' }
    return { name, status: value.length >= 16 ? 'VALID_SHAPE' : 'INVALID_SHAPE' }
  })
}
export async function checkRequiredCommands(commands: readonly string[]): Promise<Array<{ command: string; available: boolean }>> {
  return Promise.all(commands.map(async command => {
    try { await exec(command, ['--version'], { timeout: 3_000 }); return { command, available: true } }
    catch { return { command, available: false } }
  }))
}
