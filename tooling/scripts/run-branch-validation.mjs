import { createWriteStream, mkdirSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

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
    const child = spawn('pnpm.cmd', args, { cwd, env, shell: true, windowsHide: true })
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

function parseLog(text) {
  const clean = text.replace(/\u001b\[[0-9;]*m/g, '')
  const failures = new Set()
  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/\bFAIL\s+(.+?)(?:\s+\[.*)?$/)
    if (match) failures.add(match[1].trim().replace(/\s+/g, ' '))
    else if (/\b(error|failed|cannot find|module not found|err_[a-z_]+)\b/i.test(line)) {
      const diagnostic = line.trim().replace(/\s+/g, ' ')
      if (diagnostic.length >= 12 && diagnostic.length <= 500) failures.add(diagnostic)
    }
  }
  const lastMatch = (pattern) => [...clean.matchAll(pattern)].at(-1)?.[1]?.trim() ?? null
  return {
    failures: [...failures].sort(),
    testFiles: lastMatch(/Test Files\s+([^\r\n]+)/g),
    tests: lastMatch(/\bTests\s+([^\r\n]+)/g),
    timeouts: (clean.match(/timeout|timed out|Timeout terminating/gi) ?? []).length,
    workerErrors: (clean.match(/worker error|worker failed|failed to start.*worker|Error: Worker/gi) ?? []).length,
  }
}

function packageInfo(cwd) {
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  return { node: process.version, packageManager: pkg.packageManager ?? null }
}

async function runTarget(target) {
  const stem = `${target.name}-${suite}`
  const info = packageInfo(target.path)
  const nodeOk = process.version === 'v22.23.3'
  const pmMatch = /^pnpm@9\.15\.9\+sha512\.[a-f0-9]+$/.test(info.packageManager ?? '')
  const pnpmVersion = await new Promise((resolvePromise) => {
    const child = spawn('pnpm.cmd', ['--version'], { cwd: target.path, shell: true, windowsHide: true })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : 'unavailable'))
    child.on('error', () => resolvePromise('unavailable'))
  })
  const versionOk = nodeOk && pmMatch && pnpmVersion === '9.15.9'
  const start = performance.now()
  const installStart = performance.now()
  const install = await spawnLogged(['install', '--frozen-lockfile'], target.path, join(artifacts, `${stem}-install.log`))
  const installDurationMs = Math.round(performance.now() - installStart)
  let gate = { code: 0 }
  if (install.code === 0 && suite === 'toolchain' && target.name === 'unified') {
    gate = await spawnLogged(['repo:check'], target.path, join(artifacts, `${stem}-gate.log`))
  } else {
    await import('node:fs/promises').then(({ writeFile }) => writeFile(join(artifacts, `${stem}-gate.log`), suite === 'toolchain' ? 'Main baseline: exact runtime/packageManager checked by runner.\n' : 'No additional gate for this suite.\n'))
  }

  const suiteStart = performance.now()
  let suiteResult = { code: install.code || gate.code || (versionOk ? 0 : 1), skipped: true }
  if (install.code === 0 && gate.code === 0 && (suite !== 'toolchain' || target.name !== 'main')) {
    const logPath = join(artifacts, `${stem}.log`)
    suiteResult = { code: 0 }
    for (const args of suiteCommands(target)) {
      const result = await spawnLogged(args, target.path, logPath, {
        ...process.env,
        NEXT_PUBLIC_SITE_URL: 'https://example.invalid',
      }, suiteResult.ran === true)
      suiteResult.ran = true
      if (result.code !== 0) suiteResult.code = result.code
    }
  }
  const suiteDurationMs = Math.round(performance.now() - suiteStart)
  const logPath = join(artifacts, `${stem}.log`)
  const log = suiteResult.skipped ? '' : readFileSync(logPath, 'utf8')
  const parsed = parseLog(log)
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
    ...parsed,
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(artifacts, `${stem}.json`), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`${target.name}/${suite}: runtime=${versionOk ? 'PASS' : 'FAIL'}, install=${install.code}, suite=${suiteResult.code}, elapsed=${summary.totalDurationMs}ms`)
  return summary
}

const mainPath = resolve(root, '..', 'main-validation')
const mainRef = process.env.MAIN_REF ?? 'origin/main'
const mainHead = await new Promise((resolvePromise) => {
  const child = spawn('git', ['rev-parse', mainRef], { cwd: root, shell: true, windowsHide: true })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : null))
})
if (!mainHead) throw new Error(`Unable to resolve ${mainRef}`)
const hasMainWorktree = await new Promise((resolvePromise) => {
  const child = spawn('git', ['worktree', 'list', '--porcelain'], { cwd: root, shell: true, windowsHide: true })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.on('close', () => resolvePromise(output.includes(mainPath)))
})
if (!hasMainWorktree) {
  const add = await new Promise((resolvePromise) => {
    const child = spawn('git', ['worktree', 'add', '--detach', mainPath, mainHead], { cwd: root, shell: true, windowsHide: true, stdio: 'inherit' })
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
  if (add !== 0) throw new Error(`Unable to create isolated main worktree at ${mainPath}`)
}

const unifiedHead = await new Promise((resolvePromise) => {
  const child = spawn('git', ['rev-parse', 'HEAD'], { cwd: root, shell: true, windowsHide: true })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.on('close', (code) => resolvePromise(code === 0 ? output.trim() : null))
})
const results = []
for (const target of [
  { name: 'main', ref: mainRef, commit: mainHead, path: mainPath },
  { name: 'unified', ref: 'implementation/unified', commit: unifiedHead, path: root },
]) {
  results.push(await runTarget(target))
}

if (results.some((result) => !result.versionOk || result.installExitCode !== 0 || result.gateExitCode !== 0 || result.suiteExitCode !== 0)) {
  process.exitCode = 1
}
