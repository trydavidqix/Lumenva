import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'parity-artifacts')
mkdirSync(artifactRoot, { recursive: true })

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const summaries = (existsSync(artifactRoot) ? filesUnder(artifactRoot) : [])
  .filter((path) => path.endsWith('.json') && !path.endsWith('comparison.json'))
  .map((path) => JSON.parse(readFileSync(path, 'utf8')))
const bySuite = new Map()
function failuresFromArtifacts(branch, suite, summary) {
  const logPath = join(artifactRoot, `${branch}-${suite}.log`)
  if (!existsSync(logPath)) return suite === 'unit' ? summary.failures : []
  const log = readFileSync(logPath, 'utf8')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[A-Z]:\\a\\Lumenva\\(?:main-validation|Lumenva)/gi, '<CHECKOUT>')
  const failures = new Set()
  for (const line of log.split(/\r?\n/)) {
    const testFailure = suite === 'unit' ? line.match(/^\s*FAIL\s+(.+?)(?:\s+\[.*)?$/) : null
    const diagnostic = suite !== 'unit' && /^\s*(?:>\s*)?(?:Error:|ERR_[A-Z0-9_]+|Build error occurred|error TS\d+:|Failed to compile|Module not found:)/i.test(line)
    if (testFailure) failures.add(testFailure[1].trim().replace(/\s+/g, ' '))
    else if (diagnostic) failures.add(line.trim().replace(/\s+/g, ' '))
  }
  return [...failures].sort()
}

for (const suite of [...new Set(summaries.map((item) => item.suite))]) {
  const main = summaries.find((item) => item.suite === suite && item.branch === 'main')
  const unified = summaries.find((item) => item.suite === suite && item.branch === 'unified')
  if (!main || !unified) continue
  const mainFailureList = failuresFromArtifacts('main', suite, main)
  const unifiedFailureList = failuresFromArtifacts('unified', suite, unified)
  const mainFailures = new Set(mainFailureList)
  const unifiedFailures = new Set(unifiedFailureList)
  const preexisting = [...unifiedFailures].filter((failure) => mainFailures.has(failure))
  const regressions = [...unifiedFailures].filter((failure) => !mainFailures.has(failure))
  const resolved = [...mainFailures].filter((failure) => !unifiedFailures.has(failure))
  const mainExitCode = suite === 'toolchain' && main.versionOk && main.installExitCode === 0 ? 0 : main.suiteExitCode
  const unifiedExitCode = suite === 'toolchain' && unified.versionOk && unified.installExitCode === 0 ? 0 : unified.suiteExitCode
  const suiteRegression = unifiedExitCode !== 0 && (mainExitCode === 0 || regressions.length > 0)
  const unknownFailure = unifiedExitCode !== 0 && mainExitCode !== 0 && !preexisting.length && !regressions.length
  const unitRegression = suiteRegression
    || unified.timeouts > main.timeouts
    || unified.workerErrors > main.workerErrors
  const unitOutcome = unitRegression
    ? 'REGRESSION'
    : unifiedExitCode === 0
      ? 'PASS'
      : preexisting.length || (unified.timeouts === main.timeouts && unified.workerErrors === main.workerErrors)
        ? 'PREEXISTING'
        : 'UNKNOWN'
  bySuite.set(suite, {
    main: { commit: main.commit, exitCode: mainExitCode, durationMs: main.suiteDurationMs, failures: mainFailureList.length, timeouts: main.timeouts, workerErrors: main.workerErrors, testFiles: main.testFiles, tests: main.tests },
    unified: { commit: unified.commit, exitCode: unifiedExitCode, durationMs: unified.suiteDurationMs, failures: unifiedFailureList.length, timeouts: unified.timeouts, workerErrors: unified.workerErrors, testFiles: unified.testFiles, tests: unified.tests },
    classification: suite === 'unit'
      ? { outcome: unitOutcome, preexisting, regressions, resolved }
      : { result: suiteRegression ? 'REGRESSION' : unified.suiteExitCode === 0 ? 'PASS' : unknownFailure ? 'UNKNOWN — signature not comparable' : 'PREEXISTING' },
  })
}

const missingSuites = ['unit', 'typecheck', 'lint', 'build', 'toolchain'].filter((suite) => !bySuite.has(suite))
const report = {
  generatedAt: new Date().toISOString(),
  runtime: { node: '22.23.3', pnpm: '9.15.9', runner: 'windows-2025', comparison: 'pinned main/unified SHAs run sequentially per suite on the same runner' },
  missingSuites,
  suites: Object.fromEntries(bySuite),
}
const markdown = [
  '# Branch parity validation',
  '',
  `Generated: ${report.generatedAt}`,
  `Runner: ${report.runtime.runner}; Node ${report.runtime.node}; pnpm ${report.runtime.pnpm}.`,
  'Each pinned main/unified SHA pair runs sequentially on the same runner with a frozen install. Test failures are matched by exact test identifier; unmatched unified failures are regressions. Unmatched non-test failures remain UNKNOWN until their signatures can be compared.',
  '',
  '| Suite | main | unified | tests (main / unified) | failed IDs (main / unified) | timeouts (main / unified) | worker errors (main / unified) | duration (main / unified) | Classification |',
  '|---|---:|---:|---|---:|---:|---:|---:|---|',
  ...Object.entries(report.suites).map(([name, result]) => {
    const classification = result.classification.result
      ?? `${result.classification.outcome}: PREEXISTING ${result.classification.preexisting.length} / REGRESSION ${result.classification.regressions.length} / RESOLVED ${result.classification.resolved.length}`
    const mainTests = String(result.main.tests ?? 'n/a').replace(/\|/g, '\\|').replace(/\s+/g, ' ')
    const unifiedTests = String(result.unified.tests ?? 'n/a').replace(/\|/g, '\\|').replace(/\s+/g, ' ')
    return `| ${name} | ${result.main.exitCode === 0 ? 'PASS' : 'FAIL'} | ${result.unified.exitCode === 0 ? 'PASS' : 'FAIL'} | ${mainTests} / ${unifiedTests} | ${result.main.failures} / ${result.unified.failures} | ${result.main.timeouts} / ${result.unified.timeouts} | ${result.main.workerErrors} / ${result.unified.workerErrors} | ${result.main.durationMs}ms / ${result.unified.durationMs}ms | ${classification} |`
  }),
  ...(missingSuites.length ? ['', `MISSING SUITES: ${missingSuites.join(', ')}`] : []),
  '',
  '## Test failure classification',
  '',
  ...Object.entries(report.suites).filter(([, result]) => result.classification.preexisting).flatMap(([name, result]) => [
    `### ${name}`,
    '',
    `PREEXISTING (${result.classification.preexisting.length}):`,
    ...result.classification.preexisting.map((failure) => `- ${failure}`),
    '',
    `REGRESSION (${result.classification.regressions.length}):`,
    ...(result.classification.regressions.length ? result.classification.regressions.map((failure) => `- ${failure}`) : ['- none']),
    '',
  ]),
  'Raw logs and per-branch summaries are preserved in the workflow artifacts.',
].join('\n')

writeFileSync(join(artifactRoot, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(join(artifactRoot, 'comparison.md'), `${markdown}\n`)
console.log(markdown)
if (missingSuites.length) process.exitCode = 1
