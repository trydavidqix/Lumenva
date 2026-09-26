import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const failures = []
const expectedNode = 'v22.23.3'
const expectedPnpm = '9.15.9'

function fail(message) {
  failures.push(message)
}

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function filesUnder(relativePath) {
  const absolutePath = join(root, relativePath)
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') return []
      return filesUnder(join(relativePath, entry.name))
    }
    return [join(relativePath, entry.name)]
  })
}

function runPnpm(args, options = {}) {
  const command = `pnpm ${args.join(' ')}`
  return execSync(command, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', ...options })
}

const rootManifest = JSON.parse(read('package.json'))
const workspaceText = read('pnpm-workspace.yaml')
const lockText = read('pnpm-lock.yaml')
const packageManager = rootManifest.packageManager ?? ''
const packageManagerMatch = /^pnpm@(\d+\.\d+\.\d+)(\+sha512\.[a-f0-9]+)?$/.exec(packageManager)

if (process.version !== expectedNode) fail(`Node must be ${expectedNode}; found ${process.version}`)
let pnpmVersion = ''
try {
  pnpmVersion = runPnpm(['--version']).trim()
} catch (error) {
  fail(`Could not execute pnpm: ${error.message}`)
}
if (pnpmVersion !== expectedPnpm) fail(`pnpm must be ${expectedPnpm}; found ${pnpmVersion || 'unavailable'}`)
if (packageManagerMatch?.[1] !== expectedPnpm || !packageManagerMatch?.[2]) {
  fail('Root packageManager must pin pnpm 9.15.9 and retain its integrity hash suffix')
}
if (rootManifest.engines?.node !== '22.23.3' || rootManifest.engines?.pnpm !== expectedPnpm) {
  fail('Root engines must pin Node 22.23.3 and pnpm 9.15.9')
}

const catalogHeader = workspaceText.match(/^catalog:\s*\r?\n/m)
const catalogOffset = catalogHeader ? catalogHeader.index + catalogHeader[0].length : -1
const catalogTail = catalogOffset >= 0 ? workspaceText.slice(catalogOffset) : ''
const nextRootKey = /^\S[^\r\n]*:/m.exec(catalogTail)
const catalogBlock = nextRootKey ? catalogTail.slice(0, nextRootKey.index) : catalogTail
const catalog = new Map()
for (const line of catalogBlock.split(/\r?\n/)) {
  const match = /^  (?:'([^']+)'|([^:#]+)):\s*(\S.*?)\s*$/.exec(line)
  if (match) catalog.set((match[1] ?? match[2]).trim(), match[3].trim())
}
if (!catalog.size) fail('Could not read the default dependency catalog in pnpm-workspace.yaml')
if (catalog.get('@vitest/coverage-v8') !== catalog.get('vitest')) {
  fail('@vitest/coverage-v8 must use the same canonical version as vitest')
}

let projects = []
try {
  projects = JSON.parse(runPnpm(['-r', 'list', '--depth', '-1', '--json']))
} catch (error) {
  fail(`Could not enumerate pnpm workspaces: ${error.message}`)
}
const manifests = []
for (const project of projects) {
  try {
    const path = join(project.path, 'package.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    manifests.push({ path, manifest })
    if (manifest.pnpm?.overrides) fail(`${manifest.name}: overrides must live only in the workspace root`)
    if (manifest.engines?.node && manifest.engines.node !== '22.23.3') {
      fail(`${manifest.name}: engines.node must be 22.23.3, found ${manifest.engines.node}`)
    }
  } catch (error) {
    fail(`Invalid workspace manifest at ${project.path}: ${error.message}`)
  }
}

const direct = new Map()
for (const { manifest, path } of manifests) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (specifier.startsWith('catalog:')) {
        const catalogName = specifier === 'catalog:' ? name : specifier.slice('catalog:'.length)
        if (!catalog.has(catalogName)) fail(`${manifest.name}: ${name} refers to missing catalog entry ${catalogName}`)
      }
      if (!specifier.startsWith('workspace:')) {
        const entries = direct.get(name) ?? []
        entries.push({ name: manifest.name ?? path, section, specifier })
        direct.set(name, entries)
      }
    }
  }
}

for (const [name, entries] of direct) {
  const isShared = entries.length > 1
  const isPinnedFamily = name === 'typescript' || name === 'react' || name === 'react-dom' || name === 'next' || name === 'vitest'
    || (name.startsWith('@types/') && isShared)
  if (isShared || isPinnedFamily) {
    const nonCatalog = entries.filter(({ specifier }) => !specifier.startsWith('catalog:') && !specifier.startsWith('workspace:'))
    if (nonCatalog.length) {
      fail(`${name}: shared direct dependency must use catalog: in every workspace (${nonCatalog.map(entry => `${entry.name}=${entry.specifier}`).join(', ')})`)
    }
    if (!catalog.has(name)) fail(`${name}: shared direct dependency has no canonical catalog entry`)
  }
}

if (!/^22\.23\.3\s*$/.test(read('.nvmrc'))) fail('.nvmrc must contain exactly 22.23.3')
const workflowFiles = filesUnder('.github/workflows').filter(path => /\.ya?ml$/i.test(path))
for (const path of workflowFiles) {
  const workflow = read(path)
  if (/uses:\s*actions\/setup-node@/i.test(workflow) && !/node-version-file:\s*\.nvmrc/.test(workflow)) {
    fail(`${path}: setup-node must read the canonical .nvmrc`)
  }
  if (/node-version:\s*['"]?(?!22\.23\.3\b)[^\s'"]+/m.test(workflow)) fail(`${path}: manual node-version conflicts with .nvmrc`)
  if (/uses:\s*pnpm\/action-setup@/i.test(workflow) && /pnpm-version:/i.test(workflow)) {
    fail(`${path}: do not duplicate pnpm version; use root packageManager`)
  }
  if (/pnpm install --frozen-lockfile/.test(workflow) && !/pnpm repo:check/.test(workflow)) {
    fail(`${path}: frozen CI install must be followed by the canonical repo:check gate`)
  }
}

const dockerFiles = filesUnder('.').filter(path => /(^|[\\/])Dockerfile[^\\/]*$/i.test(path))
for (const path of dockerFiles) {
  const dockerfile = read(path)
  for (const match of dockerfile.matchAll(/^FROM\s+(node:[^\s]+)/gim)) {
    if (!/^node:22\.23\.3(?:-|$)/.test(match[1])) fail(`${path}: ${match[1]} must pin Node 22.23.3`)
  }
}

for (const path of ['Dockerfile', 'Dockerfile.worker']) {
  if (!read(path).includes('corepack enable')) fail(`${path}: Corepack must be enabled to honor root packageManager`)
  if (/corepack prepare pnpm@/i.test(read(path))) fail(`${path}: pnpm version must come from root packageManager`)
}

const cloudBuild = read('cloudbuild.yaml')
for (const [, image] of cloudBuild.matchAll(/name:\s*['"](node:[^\s'"]+)['"]/g)) {
  if (image !== 'node:22.23.3') fail(`cloudbuild.yaml: ${image} must be node:22.23.3`)
}
if (!cloudBuild.includes('pnpm install --frozen-lockfile') || !cloudBuild.includes('pnpm test:unit')) {
  fail('cloudbuild.yaml must install with the canonical frozen pnpm lockfile and run the unit-test gate')
}

const deploymentManifest = JSON.parse(read('apps/social-web/package.json'))
const vercel = JSON.parse(read('apps/social-web/vercel.json'))
if (deploymentManifest.engines?.node !== '22.23.3') fail('Vercel app package.json must declare Node 22.23.3')
if (!String(vercel.installCommand).includes('install --frozen-lockfile')) fail('Vercel install must use the canonical frozen lockfile')
if (!String(vercel.buildCommand).includes('repo:check')) fail('Vercel build must run repo:check before application build')

if (!/^lockfileVersion:\s*'9\.0'/m.test(lockText)) fail('pnpm-lock.yaml must use the expected pnpm 9 lockfile format')
try {
  runPnpm(['install', '--frozen-lockfile', '--ignore-scripts'], { stdio: 'pipe', env: process.env })
} catch (error) {
  fail(`Frozen lockfile validation failed: ${error.stderr?.toString() || error.message}`)
}

if (failures.length) {
  console.error(`repo:check failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`repo:check passed — Node ${process.version.slice(1)}, pnpm ${pnpmVersion}, ${manifests.length} workspace manifests, catalog/CI/Docker/deploy/lockfile aligned.`)
}
