import { describe, expect, it } from 'vitest'
import { parseTaskStartArgs } from './cli-args.ts'

describe('task start arguments', () => {
  it('requires id, name, and a non-empty gate list', () => {
    expect(() => parseTaskStartArgs(['start'])).toThrow(/--id/i)
    expect(() => parseTaskStartArgs(['--id', 'TASK-1', '--name', 'Name'])).toThrow(/--gates/i)
    expect(() => parseTaskStartArgs(['--id', 'TASK-1', '--name', 'Name', '--gates', ''])).toThrow(/--gates/i)
  })

  it('never treats the subcommand as an option value', () => {
    expect(() => parseTaskStartArgs(['start', '--name', 'Name', '--gates', 'unit'])).toThrow(/--id/i)
  })
})
