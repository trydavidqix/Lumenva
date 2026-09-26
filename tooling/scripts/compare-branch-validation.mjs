import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { extractFailureSignatures } from './branch-validation-parser.mjs'
import { reconstructToolchainSummary } from './branch-validation-summary.mjs'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = resolve(process.env.PARITY_ARTIFACT_DIR ?? join(root, 'parity-artifacts'))
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
const reconstructedToolchain = reconstructToolchainSummary(summaries, (name) => {
  const path = join(artifactRoot, name)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
})
if (reconstructedToolchain) summaries.push(reconstructedToolchain)
const bySuite = new Map()
function failuresFromArtifacts(branch, suite, summary) {
  const logPath = join(artifactRoot, `${branch}-${suite}.log`)
  if (!existsSync(logPath)) return suite === 'unit' ? summary.failures : []
  return extractFailureSignatures(readFileSync(logPath, 'utf8'), suite)
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
  const sameFailureSignatures = mainFailureList.length === unifiedFailureList.length
    && mainFailureList.every((failure) => unifiedFailures.has(failure))
  const comparableUnitFailure = sameFailureSignatures
    && (mainFailureList.length > 0 || main.timeouts > 0 || main.workerErrors > 0)
    && unified.failedTests === main.failedTests
    && unified.timeouts === main.timeouts
    && unified.workerErrors === main.workerErrors
  const mainExecutedTests = main.passedTests + main.failedTests
  const unifiedExecutedTests = unified.passedTests + unified.failedTests
  const unitRegression = suiteRegression
    || unified.failedTests > main.failedTests
    || unifiedExecutedTests < mainExecutedTests
    || unified.skippedTests > main.skippedTests
    || unified.timeouts > main.timeouts
    || unified.workerErrors > main.workerErrors
  const unitOutcome = unitRegression
    ? 'REGRESSION'
    : unifiedExitCode === 0
      ? 'PASS'
      : comparableUnitFailure
        ? 'PREEXISTING'
        : 'UNKNOWN'
  bySuite.set(suite, {
    main: { commit: main.commit, exitCode: mainExitCode, durationMs: main.suiteDurationMs, failures: mainFailureList.length, timeouts: main.timeouts, workerErrors: main.workerErrors, testFiles: main.testFiles, tests: main.tests, passedTests: main.passedTests, failedTests: main.failedTests, skippedTests: main.skippedTests },
    unified: { commit: unified.commit, exitCode: unifiedExitCode, durationMs: unified.suiteDurationMs, failures: unifiedFailureList.length, timeouts: unified.timeouts, workerErrors: unified.workerErrors, testFiles: unified.testFiles, tests: unified.tests, passedTests: unified.passedTests, failedTests: unified.failedTests, skippedTests: unified.skippedTests },
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
  '| Suite | main | unified | passed / failed / skipped (main / unified) | failure IDs (main / unified) | timeouts (main / unified) | worker errors (main / unified) | duration (main / unified) | Classification |',
  '|---|---:|---:|---|---:|---:|---:|---:|---|',
  ...Object.entries(report.suites).map(([name, result]) => {
    const classification = result.classification.result
      ?? `${result.classification.outcome}: PREEXISTING ${result.classification.preexisting.length} / REGRESSION ${result.classification.regressions.length} / RESOLVED ${result.classification.resolved.length}`
    const testCounts = (side) => `${side.passedTests ?? 0}/${side.failedTests ?? 0}/${side.skippedTests ?? 0}`
    const duration = (side) => side.durationMs === null ? 'not recorded' : `${side.durationMs}ms`
    const provenance = result.unified.reconstructedFromArtifacts ? ' (summary reconstructed from gate/install logs)' : ''
    return `| ${name} | ${result.main.exitCode === 0 ? 'PASS' : 'FAIL'} | ${result.unified.exitCode === 0 ? 'PASS' : 'FAIL'} | ${testCounts(result.main)} / ${testCounts(result.unified)} | ${result.main.failures} / ${result.unified.failures} | ${result.main.timeouts} / ${result.unified.timeouts} | ${result.main.workerErrors} / ${result.unified.workerErrors} | ${duration(result.main)} / ${duration(result.unified)} | ${classification}${provenance} |`
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
