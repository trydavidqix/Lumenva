import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { countTimeouts, extractFailureSignatures, spawnSpec, summarizeVitestOutput } from './branch-validation-parser.mjs'
import { ensureCrmSupabaseLink } from './branch-validation-windows.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const artifacts = join(root, 'parity-artifacts')
const suite = process.argv.find((arg) => arg.startsWith('--suite='))?.split('=')[1]
const allowed = new Set(['unit', 'typecheck', 'lint', 'build', 'toolchain'])
if (!allowed.has(suite)) {
  console.error(`Usage: node tooling/scripts/run-branch-validation.mjs --suite=${[...allowed].join('|')}`)
  process.exit(2)
}

mkdirSync(artifacts, { recursive: true })

function spawnLogged(args, cwd, logPath, env = process.env, append = false) {
  return new Promise((resolvePromise) => {
    const out = createWriteStream(logPath, { flags: append ? 'a' : 'w' })
    // pnpm.cmd is a Windows batch shim. Arguments come from fixed suite commands; paths are cwd only.
    const spec = spawnSpec('pnpm', args)
    const child = spawn(spec.command, spec.args, { cwd, env, ...spec.options })
    child.stdout.pipe(out)
    child.stderr.pipe(out)
    child.on('error', (error) => {
      out.end(`\n[runner-error] ${error.stack ?? error.message}\n`)
      resolvePromise({ code: 127, error: error.message })
    })
    child.on('close', (code, signal) => {
      out.end()
      resolvePromise({ code: code ?? 1, signal })
    })
  })
}

function suiteCommands(target) {
  if (suite === 'toolchain') return []
  if (suite === 'unit') return [['test:unit']]
  if (suite === 'typecheck') return [['typecheck']]
  if (suite === 'lint') return [['lint']]
  return [
    ['--filter', 'lumenva-crm', 'exec', 'next', 'build'],
    ['--filter', '@lumenva/web', 'build'],
    ['--filter', '@lumenva/mcp', 'build'],
    ['--filter', 'lumenva-website', 'build'],
  ]
}

function parseLog(text, cwd) {
  const clean = text.replace(/[A-Z]:\\a\\Lumenva\\(?:main-validation|Lumenva)/gi, '<CHECKOUT>')
  return {
    failures: extractFailureSignatures(text, suite, cwd),
    ...summarizeVitestOutput(clean),
    timeouts: countTimeouts(clean),
    workerErrors: (clean.match(/worker error|worker failed|failed to start.*worker|Error: Worker/gi) ?? []).length,
  }
}

function packageInfo(cwd) {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  return { node: process.version, packageManager: pkg.packageManager ?? null }
}

async function runTarget(target) {
  const stem = `${target.name}-${suite}`
  if (process.platform === 'win32') ensureCrmSupabaseLink(target.path)
  const info = packageInfo(target.path)
  const nodeOk = process.version === 'v22.23.3'
  const pmMatch = /^pnpm@9\.15\.9\+sha512\.[a-f0-9]+$/.test(info.packageManager ?? '')
  const pnpmVersion = await new Promise((resolvePromise) => {
    const spec = spawnSpec('pnpm', ['--version'])
    const child = spawn(spec.command, spec.args, { cwd: target.path, ...spec.options })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : 'unavailable'))
    child.on('error', () => resolvePromise('unavailable'))
  })
  const versionOk = nodeOk && pmMatch && pnpmVersion === '9.15.9'
  const start = performance.now()
  const installStart = performance.now()
  const install = await spawnLogged(
    ['install', '--frozen-lockfile'],
    target.path,
    join(artifacts, `${stem}-install.log`),
  )
  const installDurationMs = Math.round(performance.now() - installStart)
  let gate = { code: 0 }
  if (install.code === 0 && suite === 'toolchain' && target.name === 'unified') {
    gate = await spawnLogged(['repo:check'], target.path, join(artifacts, `${stem}-gate.log`))
  } else {
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(
        join(artifacts, `${stem}-gate.log`),
        suite === 'toolchain'
          ? 'Main baseline: exact runtime/packageManager checked by runner.\n'
          : 'No additional gate for this suite.\n',
      ),
    )
  }

  const suiteStart = performance.now()
  let suiteResult = { code: install.code || gate.code || (versionOk ? 0 : 1), skipped: true }
  if (install.code === 0 && gate.code === 0 && (suite !== 'toolchain' || target.name !== 'main')) {
    const logPath = join(artifacts, `${stem}.log`)
    suiteResult = { code: 0 }
    for (const args of suiteCommands(target)) {
      const result = await spawnLogged(
        args,
        target.path,
        logPath,
        {
          ...process.env,
          NEXT_PUBLIC_SITE_URL: 'https://example.invalid',
        },
        suiteResult.ran === true,
      )
      suiteResult.ran = true
      if (result.code !== 0) suiteResult.code = result.code
    }
  }
  const suiteDurationMs = Math.round(performance.now() - suiteStart)
  const logPath = join(artifacts, `${stem}.log`)
  const log = suiteResult.skipped || suite === 'toolchain' ? '' : readFileSync(logPath, 'utf8')
  const parsed = parseLog(log, target.path)
  const summary = {
    branch: target.name,
    ref: target.ref,
    commit: target.commit,
    suite,
    node: info.node,
    pnpm: pnpmVersion,
    packageManager: info.packageManager,
    versionOk,
    installExitCode: install.code,
    gateExitCode: gate.code,
    suiteExitCode: suiteResult.code,
    installDurationMs,
    suiteDurationMs,
    totalDurationMs: Math.round(performance.now() - start),
    unitCoverageProfile:
      suite === 'unit' ? 'PR #69 registrations across 14 workspaces; identical package set on main and unified' : null,
    ...parsed,
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(artifacts, `${stem}.json`), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(
    `${target.name}/${suite}: runtime=${versionOk ? 'PASS' : 'FAIL'}, install=${install.code}, suite=${suiteResult.code}, elapsed=${summary.totalDurationMs}ms`,
  )
  return summary
}

const mainPath = resolve(root, '..', 'main-validation')
const mainRef = process.env.MAIN_REF ?? 'origin/main'
const mainHead = await new Promise((resolvePromise) => {
  const spec = spawnSpec('git', ['rev-parse', mainRef])
  const child = spawn(spec.command, spec.args, { cwd: root, ...spec.options })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : null))
})
if (!mainHead) throw new Error(`Unable to resolve ${mainRef}`)
const hasMainWorktree = await new Promise((resolvePromise) => {
  const spec = spawnSpec('git', ['worktree', 'list', '--porcelain'])
  const child = spawn(spec.command, spec.args, { cwd: root, ...spec.options })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.on('close', () => resolvePromise(output.includes(mainPath)))
})
if (!hasMainWorktree) {
  const add = await new Promise((resolvePromise) => {
    const spec = spawnSpec('git', ['worktree', 'add', '--detach', mainPath, mainHead])
    const child = spawn(spec.command, spec.args, { cwd: root, ...spec.options, stdio: 'inherit' })
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
  if (add !== 0) throw new Error(`Unable to create isolated main worktree at ${mainPath}`)
}

const unifiedHead = await new Promise((resolvePromise) => {
  const spec = spawnSpec('git', ['rev-parse', 'HEAD'])
  const child = spawn(spec.command, spec.args, { cwd: root, ...spec.options })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : null))
})
const results = []
const targets = [
  { name: 'main', ref: mainRef, commit: mainHead, path: mainPath },
  { name: 'unified', ref: 'implementation/unified', commit: unifiedHead, path: root },
]
const unitCoveragePackages = [
  'apps/website',
  'apps/social-mcp',
  'apps/social-web',
  'apps/social-worker',
  'packages/core/operating-core',
  'packages/core/social-brain/core',
  'packages/core/social-brain/db',
  'packages/core/social-brain/engineering-core',
  'packages/core/social-brain/providers/brightbean',
  'packages/core/social-brain/providers/meta',
  'packages/core/social-brain/providers/moneyprinter',
  'packages/integrations/meta',
  'packages/integrations/resend',
  'packages/integrations/stripe',
]
const unitCoverageRootCommand = 'pnpm -r --if-present --no-bail test:unit'

function assertUnitCoverageContract(repositoryPath) {
  const rootManifest = JSON.parse(readFileSync(join(repositoryPath, 'package.json'), 'utf8'))
  if (rootManifest.scripts?.['test:unit'] !== unitCoverageRootCommand) {
    throw new Error(`Root test:unit must be ${unitCoverageRootCommand}`)
  }
  for (const packagePath of unitCoveragePackages) {
    const manifestPath = join(repositoryPath, packagePath, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const expectedCommand = manifest.scripts?.test ?? 'vitest run'
    if (manifest.scripts?.['test:unit'] !== expectedCommand) {
      throw new Error(`Unit coverage command mismatch in ${packagePath}: expected ${expectedCommand}`)
    }
  }
}

function applyMainUnitCoverageOverlay() {
  const originals = new Map()
  const restore = () => {
    for (const [path, original] of originals) writeFileSync(path, original)
  }
  try {
    const rootPath = join(mainPath, 'package.json')
    const rootOriginal = readFileSync(rootPath)
    const rootManifest = JSON.parse(rootOriginal.toString('utf8'))
    if (rootManifest.scripts?.['test:unit'] !== unitCoverageRootCommand) {
      originals.set(rootPath, rootOriginal)
      rootManifest.scripts['test:unit'] = unitCoverageRootCommand
      writeFileSync(rootPath, `${JSON.stringify(rootManifest, null, 2)}\n`)
    }
    for (const relativePath of unitCoveragePackages.map((path) => join(path, 'package.json'))) {
      const path = join(mainPath, relativePath)
      const original = readFileSync(path)
      const manifest = JSON.parse(original.toString('utf8'))
      manifest.scripts ??= {}
      const expectedCommand = manifest.scripts.test ?? 'vitest run'
      if (manifest.scripts['test:unit'] && manifest.scripts['test:unit'] !== expectedCommand) {
        throw new Error(`Main coverage overlay conflicts with existing test:unit command in ${relativePath}`)
      }
      if (!manifest.scripts['test:unit']) {
        manifest.scripts['test:unit'] = expectedCommand
        originals.set(path, original)
        writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
      }
    }

    const pathFixes = [
      {
        path: 'packages/core/operating-core/src/receipt-store.integration.test.ts',
        transform: (source) =>
          source
            .replace(
              'import { join } from "node:path";',
              'import { dirname, join, resolve } from "node:path";\nimport { fileURLToPath } from "node:url";',
            )
            .replace(
              'let adminUrl = "";',
              'let adminUrl = "";\nconst repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");',
            )
            .replace(
              'join(process.cwd(), "infra/supabase/migrations/20260917100800_0193_operating_core_receipts.sql")',
              'join(repositoryRoot, "infra/supabase/migrations/20260917100800_0193_operating_core_receipts.sql")',
            ),
      },
      {
        path: 'packages/core/social-brain/engineering-core/src/foundation-coverage.test.ts',
        transform: (source) =>
          source
            .replace(
              "import { readFile } from 'node:fs/promises'",
              "import { readFile } from 'node:fs/promises'\nimport { dirname, join, resolve } from 'node:path'\nimport { fileURLToPath } from 'node:url'",
            )
            .replace(
              "describe('foundation coverage audit'",
              "const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')\n\ndescribe('foundation coverage audit'",
            )
            .replace(
              "new URL('../../../apps/web/package.json', import.meta.url)",
              "join(repositoryRoot, 'apps/social-web/package.json')",
            ),
      },
    ]
    for (const fix of pathFixes) {
      const path = join(mainPath, fix.path)
      const original = readFileSync(path)
      const updated = fix.transform(original.toString('utf8'))
      if (updated === original.toString('utf8'))
        throw new Error(`Coverage overlay did not apply expected path fix: ${fix.path}`)
      originals.set(path, original)
      writeFileSync(path, updated)
    }
    assertUnitCoverageContract(mainPath)
    writeFileSync(
      join(artifacts, 'unit-coverage-profile.json'),
      `${JSON.stringify({ profile: 'PR #69 package unit-test discovery', rootCommand: unitCoverageRootCommand, packageCount: unitCoveragePackages.length, packages: unitCoveragePackages, mainOverlayPathFixes: pathFixes.map(({ path }) => path) }, null, 2)}\n`,
    )
    return restore
  } catch (error) {
    restore()
    throw error
  }
}

const restoreMainOverlay = suite === 'unit' ? applyMainUnitCoverageOverlay() : () => {}
try {
  if (suite === 'unit') assertUnitCoverageContract(root)
  for (const target of targets) results.push(await runTarget(target))
} finally {
  restoreMainOverlay()
}

if (
  results.some(
    (result) =>
      !result.versionOk || result.installExitCode !== 0 || result.gateExitCode !== 0 || result.suiteExitCode !== 0,
  )
) {
  process.exitCode = 1
}
