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
for (const suite of [...new Set(summaries.map((item) => item.suite))]) {
  const main = summaries.find((item) => item.suite === suite && item.branch === 'main')
  const unified = summaries.find((item) => item.suite === suite && item.branch === 'unified')
  if (!main || !unified) continue
  const mainFailures = new Set(main.failures)
  const unifiedFailures = new Set(unified.failures)
  const preexisting = [...unifiedFailures].filter((failure) => mainFailures.has(failure))
  const regressions = [...unifiedFailures].filter((failure) => !mainFailures.has(failure))
  const resolved = [...mainFailures].filter((failure) => !unifiedFailures.has(failure))
  const suiteRegression = unified.suiteExitCode !== 0 && (main.suiteExitCode === 0 || regressions.length > 0)
  const sharedFailures = preexisting
  const unknownFailure = unified.suiteExitCode !== 0 && main.suiteExitCode !== 0 && !sharedFailures.length && !regressions.length
  bySuite.set(suite, {
    main: { commit: main.commit, exitCode: main.suiteExitCode, durationMs: main.suiteDurationMs, failures: main.failures.length, timeouts: main.timeouts, workerErrors: main.workerErrors, testFiles: main.testFiles, tests: main.tests },
    unified: { commit: unified.commit, exitCode: unified.suiteExitCode, durationMs: unified.suiteDurationMs, failures: unified.failures.length, timeouts: unified.timeouts, workerErrors: unified.workerErrors, testFiles: unified.testFiles, tests: unified.tests },
    classification: suite === 'unit'
      ? { preexisting, regressions, resolved }
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
      ?? `PREEXISTING ${result.classification.preexisting.length} / REGRESSION ${result.classification.regressions.length} / RESOLVED ${result.classification.resolved.length}`
    return `| ${name} | ${result.main.exitCode === 0 ? 'PASS' : 'FAIL'} | ${result.unified.exitCode === 0 ? 'PASS' : 'FAIL'} | ${result.main.tests ?? 'n/a'} / ${result.unified.tests ?? 'n/a'} | ${result.main.failures} / ${result.unified.failures} | ${result.main.timeouts} / ${result.unified.timeouts} | ${result.main.workerErrors} / ${result.unified.workerErrors} | ${result.main.durationMs}ms / ${result.unified.durationMs}ms | ${classification} |`
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
