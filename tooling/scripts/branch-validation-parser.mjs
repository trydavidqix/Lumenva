function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripRunnerPrefix(line) {
  if (/^\s*(?:ERR_|Error:|Build error occurred|error TS\d+:|Failed to compile|Module not found:)/i.test(line)) {
    return line.trimStart()
  }
  return line.replace(/^.*?\b(?:test:unit|typecheck|lint|build):\s*/, '').trimStart()
}

export function extractFailureSignatures(text, suite, checkoutPath) {
  const checkoutPattern = checkoutPath ? new RegExp(escapeRegex(checkoutPath), 'gi') : null
  const failures = new Set()
  const clean = text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[A-Z]:\\a\\Lumenva\\(?:main-validation|Lumenva)/gi, '<CHECKOUT>')
    .replace(checkoutPattern ?? /$^/, '<CHECKOUT>')

  for (const rawLine of clean.split(/\r?\n/)) {
    const line = stripRunnerPrefix(rawLine)
    const testFailure = suite === 'unit' ? line.match(/^FAIL\s+(.+?)(?:\s+\[.*)?$/) : null
    const diagnostic = suite !== 'unit'
      && /^(?:>\s*)?(?:Error:|ERR_[A-Z0-9_]+|Build error occurred|error TS\d+:|Failed to compile|Module not found:)/i.test(line)

    if (testFailure) failures.add(testFailure[1].trim().replace(/\s+/g, ' '))
    else if (diagnostic) {
      const normalized = line.trim().replace(/\s+/g, ' ')
      if (normalized.length >= 12 && normalized.length <= 500) failures.add(normalized)
    }
  }

  return [...failures].sort()
}

export function summarizeVitestOutput(text) {
  const lines = text.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/)
  const testLines = lines.filter((line) => /\bTests\s+/i.test(line))
  const fileLines = lines.filter((line) => /\bTest Files\s+/i.test(line))
  const total = (entries, state) => entries.reduce((sum, line) => {
    const value = line.match(new RegExp(`(\\d+)\\s+${state}\\b`, 'i'))
    return sum + Number(value?.[1] ?? 0)
  }, 0)
  const passedTests = total(testLines, 'passed')
  const failedTests = total(testLines, 'failed')
  const skippedTests = total(testLines, 'skipped')
  const passedFiles = total(fileLines, 'passed')
  const failedFiles = total(fileLines, 'failed')
  const skippedFiles = total(fileLines, 'skipped')
  const format = (passed, failed, skipped) => [
    failed ? `${failed} failed` : null,
    passed ? `${passed} passed` : null,
    skipped ? `${skipped} skipped` : null,
  ].filter(Boolean).join(' | ') || 'no test summary'

  return {
    passedTests,
    failedTests,
    skippedTests,
    testFiles: format(passedFiles, failedFiles, skippedFiles),
    tests: format(passedTests, failedTests, skippedTests),
    packageSummaries: Math.max(testLines.length, fileLines.length),
  }
}
