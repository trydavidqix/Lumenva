import { lstatSync, realpathSync, statSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'

export function ensureCrmSupabaseLink(repositoryPath) {
  const repositoryRoot = resolve(repositoryPath)
  const target = resolve(repositoryRoot, 'infra/supabase')
  const link = resolve(repositoryRoot, 'apps/crm/supabase')

  try {
    lstatSync(target)
  } catch {
    throw new Error(`The canonical Supabase directory is missing: ${target}`)
  }

  let linkExists = true
  try {
    lstatSync(link)
  } catch (error) {
    if (error.code === 'ENOENT') linkExists = false
    else throw error
  }

  if (linkExists) {
    let existing
    try {
      existing = realpathSync(link)
    } catch {
      throw new Error(`The CRM Supabase path exists but cannot be resolved: ${link}`)
    }
    if (!statSync(link).isDirectory()) {
      throw new Error(`The CRM Supabase path exists but is not a directory link: ${link}`)
    }
    if (existing === realpathSync(target)) return 'existing'
    throw new Error(`The CRM Supabase path points elsewhere: ${link}`)
  }

  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
  return 'created'
}
