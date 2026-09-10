// Repository tooling kept as a dependency-free .mjs so this gate also runs on a checkout with no node_modules.
import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const SCRIPT_NAME = 'lint-baseline-compare'
const KEY_SEPARATOR = '\u0000'
const FATAL_RULE_SENTINEL = '(fatal)'
const EXIT_OK = 0
const EXIT_NEW_FINDINGS = 1
const EXIT_USAGE = 2

const USAGE = [
  'Usage: node scripts/lint-baseline-compare.mjs <baseline.json> <after.json>',
  '',
  'Compares two ESLint JSON reports (npx eslint --no-fix -f json . -o <file>) and fails only on findings that are',
  'absent from the baseline. Findings are matched by repo-relative file path, rule id and message, so the two',
  'reports may come from different checkout roots.',
  '',
  'Exit codes:',
  '  0  no new findings — every after-report finding is covered by the baseline, or the baseline holds more',
  '  1  at least one finding is absent from the baseline, or exceeds its baseline occurrence count',
  '  2  usage or input error — wrong argument count, unreadable file, malformed JSON, or a wrong report shape',
  '',
  'A report whose results all sit inside one deep directory carries no repository-root-level file to anchor on, so',
  'its common directory prefix is that directory; reports produced by "eslint ." always include root-level files',
  'such as .eslintrc.js and are unaffected.'
].join('\n')

const PASS_NOTE =
  '"eslint ." itself still exits non-zero while those baseline findings remain; that exit code is not this gate.'

const REMEDY =
  'Fix the new findings in the files you changed — do not edit untouched files and do not regenerate the baseline.'

const EMPTY_BASELINE_NOTE = [
  'the baseline report holds 0 findings, which usually means it was not captured from the pristine base commit;',
  'every finding in the after report is therefore counted as new'
].join(' ')

const toPosix = value => value.replace(/\\/g, '/')

const segmentsOf = posixPath => posixPath.split('/')

const describeType = value => (value === null ? 'null' : typeof value)

const toPosition = value => (Number.isFinite(value) ? value : 0)

const ruleLabel = ruleId => (typeof ruleId === 'string' && ruleId.length > 0 ? ruleId : FATAL_RULE_SENTINEL)

const compareStrings = (left, right) => {
  if (left < right) {
    return -1
  }

  return left > right ? 1 : 0
}

const commonDirPrefix = posixPaths => {
  const directories = posixPaths.map(posixPath => segmentsOf(posixPath).slice(0, -1))

  if (directories.length === 0) {
    return ''
  }

  let shared = directories[0]

  for (const candidate of directories.slice(1)) {
    const limit = Math.min(shared.length, candidate.length)
    let matched = 0

    while (matched < limit && shared[matched] === candidate[matched]) {
      matched += 1
    }

    shared = shared.slice(0, matched)
  }

  return shared.join('/')
}

// ESLint records absolute filePaths and the baseline is captured under a different checkout root than the run it is
// compared against, so raw filePaths are never comparable: every finding is keyed on a repo-relative POSIX path
// obtained by stripping the root that its own report was produced under.
const resolveReportRoot = (posixFilePaths, localRoot) => {
  if (posixFilePaths.length === 0) {
    return ''
  }

  const localPrefix = `${localRoot}/`

  if (posixFilePaths.every(posixPath => posixPath.startsWith(localPrefix))) {
    return localRoot
  }

  return commonDirPrefix(posixFilePaths)
}

const normalizePath = (posixFilePath, reportRoot) => {
  const rootPrefix = reportRoot === '' ? '' : `${reportRoot}/`
  const isUnderRoot = rootPrefix !== '' && posixFilePath.startsWith(rootPrefix)
  const withoutRoot = isUnderRoot ? posixFilePath.slice(rootPrefix.length) : posixFilePath

  return withoutRoot.replace(/^\.\//, '').replace(/^\/+/, '')
}

const findingKey = (relativePath, ruleId, message) => [relativePath, ruleLabel(ruleId), message].join(KEY_SEPARATOR)

const compareOccurrences = (left, right) =>
  compareStrings(left.relativePath, right.relativePath) ||
  left.line - right.line ||
  left.column - right.column ||
  compareStrings(left.rule, right.rule) ||
  compareStrings(left.message, right.message)

const sortOccurrences = occurrences => [...occurrences].sort(compareOccurrences)

const describeReportProblem = (report, label) => {
  if (!Array.isArray(report)) {
    return `${label} is not an ESLint JSON report: expected a top-level array, found ${describeType(report)}`
  }

  for (const [index, entry] of report.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return `${label} holds a non-object result at index ${index}`
    }

    if (typeof entry.filePath !== 'string' || entry.filePath === '') {
      return `${label} holds a result at index ${index} without a non-empty string "filePath"`
    }

    if (entry.messages !== undefined && !Array.isArray(entry.messages)) {
      return `${label} holds a non-array "messages" for ${entry.filePath}`
    }

    for (const message of entry.messages ?? []) {
      if (message === null || typeof message !== 'object' || Array.isArray(message)) {
        return `${label} holds a non-object message for ${entry.filePath}`
      }

      if (typeof message.message !== 'string') {
        return `${label} holds a message without a string "message" for ${entry.filePath}`
      }
    }
  }

  return null
}

const tallyFindings = (report, localRoot) => {
  const posixFilePaths = report.map(entry => toPosix(entry.filePath))
  const reportRoot = resolveReportRoot(posixFilePaths, localRoot)
  const occurrences = []
  const counts = new Map()

  report.forEach((entry, index) => {
    const relativePath = normalizePath(posixFilePaths[index], reportRoot)

    for (const message of entry.messages ?? []) {
      const key = findingKey(relativePath, message.ruleId, message.message)

      occurrences.push({
        key,
        relativePath,
        rule: ruleLabel(message.ruleId),
        message: message.message,
        line: toPosition(message.line),
        column: toPosition(message.column)
      })
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  })

  return {counts, occurrences: sortOccurrences(occurrences)}
}

const groupByKey = occurrences => {
  const grouped = new Map()

  for (const occurrence of occurrences) {
    const bucket = grouped.get(occurrence.key) ?? []

    bucket.push(occurrence)
    grouped.set(occurrence.key, bucket)
  }

  return grouped
}

const diffTallies = (baselineCounts, afterOccurrences) => {
  const grouped = groupByKey(afterOccurrences)
  const keys = [...grouped.keys()].sort(compareStrings)
  const introduced = []

  for (const key of keys) {
    const bucket = sortOccurrences(grouped.get(key))
    const surplus = bucket.length - (baselineCounts.get(key) ?? 0)

    if (surplus > 0) {
      introduced.push(...bucket.slice(bucket.length - surplus))
    }
  }

  return sortOccurrences(introduced)
}

const formatFinding = occurrence =>
  `${occurrence.relativePath}:${occurrence.line}:${occurrence.column}  ${occurrence.rule}  ${occurrence.message}`

const repoRootFromScriptUrl = scriptUrl => toPosix(resolve(dirname(fileURLToPath(scriptUrl)), '..'))

const loadReport = (label, filePath) => {
  let raw = ''

  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    return {problem: `cannot read ${label}: ${error.message}`}
  }

  try {
    return {report: JSON.parse(raw)}
  } catch (error) {
    return {problem: `${label} is not valid JSON: ${error.message}`}
  }
}

const reportInputProblem = problem => {
  console.error(`${SCRIPT_NAME}: ${problem}`)
  process.exitCode = EXIT_USAGE
}

const main = scriptUrl => {
  const args = process.argv.slice(2)

  if (args.length !== 2) {
    console.error(USAGE)
    process.exitCode = EXIT_USAGE

    return
  }

  const [baselinePath, afterPath] = args.map(argument => resolve(process.cwd(), argument))
  const baselineLabel = `the baseline report at ${baselinePath}`
  const afterLabel = `the after report at ${afterPath}`
  const baselineLoad = loadReport(baselineLabel, baselinePath)
  const afterLoad = loadReport(afterLabel, afterPath)
  const loadProblems = [baselineLoad.problem, afterLoad.problem].filter(problem => problem !== undefined)

  if (loadProblems.length > 0) {
    loadProblems.forEach(reportInputProblem)

    return
  }

  const shapeProblems = [
    describeReportProblem(baselineLoad.report, baselineLabel),
    describeReportProblem(afterLoad.report, afterLabel)
  ].filter(problem => problem !== null)

  if (shapeProblems.length > 0) {
    shapeProblems.forEach(reportInputProblem)

    return
  }

  const localRoot = repoRootFromScriptUrl(scriptUrl)
  const baseline = tallyFindings(baselineLoad.report, localRoot)
  const after = tallyFindings(afterLoad.report, localRoot)
  const introduced = diffTallies(baseline.counts, after.occurrences)

  if (baseline.occurrences.length === 0) {
    console.error(`${SCRIPT_NAME}: ${EMPTY_BASELINE_NOTE}`)
  }

  if (introduced.length === 0) {
    console.log(
      `${SCRIPT_NAME}: passed — 0 new findings (${after.occurrences.length} in the after report, ` +
        `${baseline.occurrences.length} in the baseline). ${PASS_NOTE}`
    )
    process.exitCode = EXIT_OK

    return
  }

  introduced.forEach(occurrence => console.log(formatFinding(occurrence)))
  console.log(`${introduced.length} new lint finding(s) not present in the baseline.`)
  console.log(REMEDY)
  process.exitCode = EXIT_NEW_FINDINGS
}

main(import.meta.url)
