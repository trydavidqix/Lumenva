import { lstatSync, readFileSync, readlinkSync, realpathSync, rmdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
      let readlinkError
      try {
        // Windows may materialize a broken Git symlink as a reparse point
        // whose lstat flags do not report isSymbolicLink().
        linkTarget = resolve(dirname(link), readlinkSync(link))
      } catch {
        readlinkError = true
      }
      let trackedLinkTarget
      try {
        const index = execFileSync('git', ['-C', repositoryRoot, 'ls-files', '--stage', '--', 'apps/crm/supabase'], {
          encoding: 'utf8',
        }).trim()
        if (index.startsWith('120000 ')) {
          trackedLinkTarget = execFileSync('git', ['-C', repositoryRoot, 'show', 'HEAD:apps/crm/supabase'], {
            encoding: 'utf8',
          }).trim()
        }
      } catch {
        // Without proof that Git tracks the expected symlink, preserve the path.
      }
      const windowsPathsMatch = (left, right) =>
        process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right
      const trackedTargetIsCanonical =
        trackedLinkTarget === '../../infra/supabase' &&
        windowsPathsMatch(resolve(dirname(link), trackedLinkTarget), target)
      if (trackedTargetIsCanonical && (linkInfo.isSymbolicLink() || linkTarget === target)) {
        if (linkInfo.isDirectory()) rmdirSync(link)
        else unlinkSync(link)
        symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')
        return 'repaired'
      }
      const kind = [linkInfo.isSymbolicLink() && 'symlink', linkInfo.isDirectory() && 'directory', linkInfo.isFile() && 'file']
        .filter(Boolean)
        .join(',') || 'other'
      throw new Error(`The CRM Supabase path exists but cannot be resolved (${kind}; readlink=${readlinkError ? 'unavailable' : linkTarget}): ${link}`)
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
