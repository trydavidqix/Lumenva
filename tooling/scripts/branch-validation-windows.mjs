import { lstatSync, readFileSync, readlinkSync, realpathSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

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
    const linkInfo = lstatSync(link)
    if (linkInfo.isFile() && !linkInfo.isSymbolicLink()) {
      const checkoutPlaceholder = readFileSync(link, 'utf8').trim()
      if (checkoutPlaceholder === '../../infra/supabase' && resolve(dirname(link), checkoutPlaceholder) === target) {
        unlinkSync(link)
        symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
        return 'repaired'
      }
    }
    let existing
    try {
      existing = realpathSync(link)
    } catch {
      let linkTarget
      if (linkInfo.isSymbolicLink()) linkTarget = resolve(dirname(link), readlinkSync(link))
      else if (linkInfo.isFile()) {
        const checkoutPlaceholder = readFileSync(link, 'utf8').trim()
        if (checkoutPlaceholder === '../../infra/supabase') {
          linkTarget = resolve(dirname(link), checkoutPlaceholder)
        }
      }
      if (linkTarget === target) {
        unlinkSync(link)
        symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
        return 'repaired'
      }
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
