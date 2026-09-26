export function reconstructToolchainSummary(summaries, readArtifact) {
  if (summaries.some((item) => item.suite === 'toolchain' && item.branch === 'unified')) return null

  const profile = summaries.find((item) => item.branch === 'unified' && item.suite === 'unit')
  const gateLog = readArtifact('unified-toolchain-gate.log') ?? ''
  const installLog = readArtifact('unified-toolchain-install.log') ?? ''
  const installMatch = installLog.match(/Done in ([\d.]+)s using pnpm v9\.15\.9/)
  const gatePassed = /repo:check passed .*Node 22\.23\.3, pnpm 9\.15\.9(?:[.,]|$)/.test(gateLog)

  if (
    !profile?.versionOk
    || profile.node !== 'v22.23.3'
    || profile.pnpm !== '9.15.9'
    || !gatePassed
    || !installMatch
  ) return null

  return {
    branch: 'unified',
    ref: 'implementation/unified',
    commit: profile.commit,
    suite: 'toolchain',
    node: profile.node,
    pnpm: profile.pnpm,
    packageManager: profile.packageManager,
    versionOk: true,
    installExitCode: 0,
    gateExitCode: 0,
    suiteExitCode: 0,
    installDurationMs: Math.round(Number(installMatch[1]) * 1000),
    suiteDurationMs: null,
    totalDurationMs: null,
    failures: [],
    testFiles: null,
    tests: null,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    timeouts: 0,
    workerErrors: 0,
    reconstructedFromArtifacts: true,
  }
}
