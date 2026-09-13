// Repository tooling kept as a dependency-free .mjs so this gate also runs on a checkout with no node_modules.
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, dirname, extname, resolve} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const SCRIPT_NAME = 'lint-baseline-compare'
const KEY_SEPARATOR = '\u0000'
const FATAL_RULE_SENTINEL = '(fatal)'
const EXIT_OK = 0
const EXIT_GATE_FAILED = 1
const EXIT_USAGE = 2

const PROJECT_FLAG = '--project'
const REQUIRE_FLAG = '--require'
const PROVENANCE_SUFFIX = '.provenance.json'
const JSON_SUFFIX = '.json'

// ESLint's own report embeds the linted file's text: `source` carries the whole file for every result that holds a
// finding, `output` carries the fixed file, and a message's `fix`/`suggestions` carry replacement source. A tracked
// baseline must not commit file content — API hosts and anything else a source file happens to hold would live in it
// for the life of the artifact — and the comparison keys on none of it, so the tracked artifact is a projection of
// the raw report with these fields elided. Everything the comparison needs (filePath, ruleId, message, line, column)
// survives untouched.
const DROPPED_RESULT_FIELDS = ['source', 'output']
const DROPPED_MESSAGE_FIELDS = ['fix', 'suggestions']

const DIGEST_ALGORITHM = 'sha256'
const DIGEST_PATTERN = /^[0-9a-f]{64}$/
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i
const MAX_LISTED_PATHS = 20

// A file the baseline never covered — one this change added or renamed — is demanded of the after report too, and
// the record says where that list comes from so the plain two-argument invocation cannot run without it: `git-diff`
// derives it from the working tree against the commit the baseline was captured on, `caller-supplied` states that
// the baseline is not tied to a commit in this repository and the caller passes --require instead.
const CHANGED_SOURCE_GIT = 'git-diff'
const CHANGED_SOURCE_CALLER = 'caller-supplied'
const CHANGED_SOURCES = [CHANGED_SOURCE_GIT, CHANGED_SOURCE_CALLER]
const GIT_OUTPUT_LIMIT = 32 * 1024 * 1024

const PROVENANCE_STRING_FIELDS = [
  'artifact',
  'sourceCommit',
  'capturedAt',
  'captureCwd',
  'captureScope',
  'captureCommand'
]
const PROVENANCE_TOTALS_FIELDS = ['lintedFiles', 'filesWithFindings', 'findings', 'errors', 'warnings']

const USAGE = [
  'Usage: node scripts/lint-baseline-compare.mjs [--require <paths>] <baseline.json> <after.json>',
  '       node scripts/lint-baseline-compare.mjs --project <raw-eslint.json> <baseline.json>',
  '',
  'Compare mode (the default) reads two ESLint JSON reports (npx eslint --no-fix -f json . -o <file>) and fails on',
  'findings absent from the baseline. Findings are matched by repo-relative file path, rule id and message, so the',
  'two reports may come from different checkout roots.',
  '',
  'It also fails closed when the after report does not cover the files it should, because a report that lints fewer',
  'files holds fewer findings and would otherwise pass: every file the baseline covers that still exists on disk',
  'must appear in the after report. A baseline path that is no longer on disk is reported as removed and is not',
  'required, so deleting or renaming a file is not a failure.',
  '',
  'A file the baseline never covered — one this change added or renamed — is required too, and the gate works out',
  'that list itself so the plain two-argument invocation above cannot run without it. The provenance record says',
  `where the list comes from: "${CHANGED_SOURCE_GIT}" derives it from the working tree against the commit the`,
  'baseline was captured on (files changed since it, plus untracked files), and a base commit this checkout cannot',
  `resolve is an error rather than a skipped check; "${CHANGED_SOURCE_CALLER}" states that the baseline is not tied`,
  'to a commit here, which is the case for a synthetic or externally captured baseline.',
  '',
  '  --require <paths>  name the changed files explicitly instead of deriving them, for a caller that already has',
  '                     the list. Comma- or newline-separated and repeatable, so it can be passed straight through:',
  '                     --require "$(git diff --name-only --diff-filter=ACMR master)". Paths are repo-relative (a',
  '                     leading repository-directory name or the absolute repository root is stripped). A path that',
  '                     no longer exists, or whose extension is outside the lint scope the baseline describes, is',
  '                     reported as skipped rather than demanded.',
  '',
  'Every baseline must be accompanied by its provenance record, named by replacing the trailing ".json" with',
  '".provenance.json" (docs/lint-baseline.json -> docs/lint-baseline.provenance.json). The record states how the',
  'baseline was captured and what it should hold; this gate refuses to compare against a baseline whose record is',
  'missing, incomplete, or inconsistent with the baseline itself, so a regenerated or edited artifact cannot pass',
  'unnoticed. Required keys:',
  `  ${PROVENANCE_STRING_FIELDS.join(', ')}  non-empty strings describing the capture`,
  `  totals.{${PROVENANCE_TOTALS_FIELDS.join(',')}}  compared against the baseline`,
  '  projection.droppedResultFields, projection.droppedMessageFields  field names that must be absent',
  '  digest.algorithm ("sha256"), digest.value  compared against the baseline\'s projected digest',
  `  changedFileCoverage.source ("${CHANGED_SOURCE_GIT}" with a "baseCommit", or "${CHANGED_SOURCE_CALLER}")`,
  '',
  'Project mode writes such a projection: it reads a raw ESLint report, elides the fields that embed file content',
  `(${DROPPED_RESULT_FIELDS.join(', ')} on a result; ${DROPPED_MESSAGE_FIELDS.join(', ')} on a message) and writes the`,
  'result, then prints the provenance record to save beside it. The digest identifies the capture rather than the',
  'file bytes: projecting an already-projected report is a no-op and hashes to the same value.',
  '',
  'Exit codes:',
  '  0  the gate passed — no finding is absent from the baseline and the expected files are covered',
  '  1  the gate failed — a finding is absent from the baseline or exceeds its baseline count, or the after report',
  '     lost coverage of a file it had to lint',
  '  2  unusable input — wrong arguments, unreadable file, malformed JSON, a wrong report shape, or a baseline that',
  '     does not match its provenance record',
  '',
  'A report whose results all sit inside one deep directory carries no repository-root-level file to anchor on, so',
  'its common directory prefix is that directory; reports produced by "eslint ." always include root-level files',
  'such as .eslintrc.js and are unaffected.'
].join('\n')

const PASS_NOTE =
  '"eslint ." itself still exits non-zero while those baseline findings remain; that exit code is not this gate.'

const REMEDY =
  'Fix the new findings in the files you changed — do not edit untouched files and do not regenerate the baseline.'

const COVERAGE_REMEDY = [
  'Re-run the after report over the whole repository from its root ("npx eslint --no-fix -f json . -o <file>").',
  'If a file left the lint scope deliberately, the baseline and its provenance record have to be recaptured as a',
  'reviewed change — this gate cannot tell that apart from an ignore, extension or scope regression.'
].join(' ')

const EMPTY_AFTER_NOTE =
  'the after report holds no results at all, so the lint run behind it covered no files; a run that lints nothing' +
  ' reports no findings and must never pass this gate'

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
  const paths = new Set()

  report.forEach((entry, index) => {
    const relativePath = normalizePath(posixFilePaths[index], reportRoot)

    paths.add(relativePath)

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

  return {counts, occurrences: sortOccurrences(occurrences), paths}
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

const withoutFields = (record, fields) =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !fields.includes(field)))

const projectMessages = messages => messages.map(message => withoutFields(message, DROPPED_MESSAGE_FIELDS))

// Pure and idempotent: reassigning an existing key leaves it in place, so projecting a report preserves its key
// order and projecting an already-projected report returns the same JSON.
const projectResults = report =>
  report.map(entry => {
    const projected = withoutFields(entry, DROPPED_RESULT_FIELDS)

    if (Array.isArray(entry.messages)) {
      projected.messages = projectMessages(entry.messages)
    }

    if (Array.isArray(entry.suppressedMessages)) {
      projected.suppressedMessages = projectMessages(entry.suppressedMessages)
    }

    return projected
  })

const serializeReport = report => JSON.stringify(report)

// Taken over the projection rather than the file, so the raw capture and the artifact committed from it share one
// digest and reformatting or a different line ending cannot change it.
const digestReport = report =>
  createHash(DIGEST_ALGORITHM)
    .update(serializeReport(projectResults(report)))
    .digest('hex')

const totalsOf = report => {
  const totals = {lintedFiles: report.length, filesWithFindings: 0, findings: 0, errors: 0, warnings: 0}

  for (const entry of report) {
    const messages = entry.messages ?? []

    if (messages.length > 0) {
      totals.filesWithFindings += 1
    }

    for (const message of messages) {
      totals.findings += 1

      if (message.severity === 1) {
        totals.warnings += 1
      } else if (message.severity === 2) {
        totals.errors += 1
      }
    }
  }

  return totals
}

const countDroppedFields = report => {
  let results = 0
  let messages = 0

  for (const entry of report) {
    if (DROPPED_RESULT_FIELDS.some(field => Object.hasOwn(entry, field))) {
      results += 1
    }

    for (const message of [...(entry.messages ?? []), ...(entry.suppressedMessages ?? [])]) {
      if (DROPPED_MESSAGE_FIELDS.some(field => Object.hasOwn(message, field))) {
        messages += 1
      }
    }
  }

  return {results, messages}
}

const provenancePathFor = baselinePath =>
  baselinePath.endsWith(JSON_SUFFIX)
    ? `${baselinePath.slice(0, -JSON_SUFFIX.length)}${PROVENANCE_SUFFIX}`
    : `${baselinePath}${PROVENANCE_SUFFIX}`

const isNonEmptyString = value => typeof value === 'string' && value.trim() !== ''

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

const fieldNamesProblem = (value, field, label) => {
  if (!Array.isArray(value)) {
    return `${label} needs an array of field names at "projection.${field}"`
  }

  return value.every(isNonEmptyString) ? null : `${label} holds a non-string entry in "projection.${field}"`
}

const presentResultFields = (report, fields) =>
  fields.filter(field => report.some(entry => Object.hasOwn(entry, field)))

const presentMessageFields = (report, fields) =>
  fields.filter(field =>
    report.some(entry =>
      [...(entry.messages ?? []), ...(entry.suppressedMessages ?? [])].some(message => Object.hasOwn(message, field))
    )
  )

const describeProjectionProblems = (projection, report, label) => {
  if (!isPlainObject(projection)) {
    return [`${label} needs a "projection" object naming the fields elided from the raw ESLint report`]
  }

  const problems = [
    fieldNamesProblem(projection.droppedResultFields, 'droppedResultFields', label),
    fieldNamesProblem(projection.droppedMessageFields, 'droppedMessageFields', label)
  ].filter(problem => problem !== null)

  if (problems.length > 0) {
    return problems
  }

  const resultLeftovers = presentResultFields(report, projection.droppedResultFields)
  const messageLeftovers = presentMessageFields(report, projection.droppedMessageFields)

  if (resultLeftovers.length > 0) {
    problems.push(
      `${label} records result field(s) ${resultLeftovers.join(', ')} as elided, but the baseline still holds them`
    )
  }

  if (messageLeftovers.length > 0) {
    problems.push(
      `${label} records message field(s) ${messageLeftovers.join(', ')} as elided, but the baseline still holds them`
    )
  }

  return problems
}

const describeTotalsProblems = (totals, report, label) => {
  if (!isPlainObject(totals)) {
    return [`${label} needs a "totals" object holding ${PROVENANCE_TOTALS_FIELDS.join(', ')}`]
  }

  const observed = totalsOf(report)
  const problems = []

  for (const field of PROVENANCE_TOTALS_FIELDS) {
    const recorded = totals[field]

    if (!Number.isInteger(recorded) || recorded < 0) {
      problems.push(`${label} needs a non-negative integer "totals.${field}"`)
    } else if (recorded !== observed[field]) {
      problems.push(`${label} records totals.${field} ${recorded}, the baseline holds ${observed[field]}`)
    }
  }

  return problems
}

const describeDigestProblems = (digest, report, label) => {
  if (!isPlainObject(digest)) {
    return [`${label} needs a "digest" object holding "algorithm" and "value"`]
  }

  if (digest.algorithm !== DIGEST_ALGORITHM) {
    return [`${label} needs digest.algorithm "${DIGEST_ALGORITHM}"`]
  }

  if (typeof digest.value !== 'string' || !DIGEST_PATTERN.test(digest.value)) {
    return [`${label} needs a 64-character lowercase hexadecimal "digest.value"`]
  }

  const observed = digestReport(report)

  return digest.value === observed
    ? []
    : [
        `${label} records digest ${digest.value}, the baseline projects to ${observed} — recapturing the baseline is` +
          ' a reviewed change: update the record beside it in the same commit'
      ]
}

const describeChangedCoverageProblems = (changedFileCoverage, label) => {
  if (!isPlainObject(changedFileCoverage)) {
    return [
      `${label} needs a "changedFileCoverage" object saying where the changed lintable files come from ` +
        `("${CHANGED_SOURCE_GIT}" with a "baseCommit", or "${CHANGED_SOURCE_CALLER}")`
    ]
  }

  const {source, baseCommit} = changedFileCoverage

  if (!CHANGED_SOURCES.includes(source)) {
    return [`${label} needs changedFileCoverage.source to be one of ${CHANGED_SOURCES.join(', ')}`]
  }

  if (source === CHANGED_SOURCE_GIT && (typeof baseCommit !== 'string' || !COMMIT_PATTERN.test(baseCommit))) {
    return [`${label} needs changedFileCoverage.baseCommit to be the commit the baseline was captured on`]
  }

  return []
}

// The provenance record is what makes the artifact self-auditing: without it a regenerated, truncated or edited
// baseline would be accepted as the reviewed one, and every comparison after that would be measured against it.
const describeProvenanceProblems = (record, report, label) => {
  if (!isPlainObject(record)) {
    return [`${label} is not a provenance record: expected a JSON object, found ${describeType(record)}`]
  }

  const problems = PROVENANCE_STRING_FIELDS.filter(field => !isNonEmptyString(record[field])).map(
    field => `${label} needs a non-empty string "${field}" stating how the baseline was captured`
  )

  problems.push(...describeTotalsProblems(record.totals, report, label))
  problems.push(...describeProjectionProblems(record.projection, report, label))
  problems.push(...describeDigestProblems(record.digest, report, label))
  problems.push(...describeChangedCoverageProblems(record.changedFileCoverage, label))

  return problems
}

const provenanceTemplate = (report, outputPath) => ({
  artifact: outputPath,
  sourceCommit: null,
  capturedAt: null,
  captureCwd: null,
  captureScope: null,
  captureCommand: null,
  projection: {
    command: `node scripts/${SCRIPT_NAME}.mjs ${PROJECT_FLAG} <raw-eslint.json> ${outputPath}`,
    droppedResultFields: DROPPED_RESULT_FIELDS,
    droppedMessageFields: DROPPED_MESSAGE_FIELDS
  },
  totals: totalsOf(report),
  digest: {algorithm: DIGEST_ALGORITHM, value: digestReport(report)},
  changedFileCoverage: {source: null, baseCommit: null}
})

// Only the extensions the baseline itself covers are demanded of the after report: this repository's ESLint scope
// takes .js, .ts and .tsx and leaves .mjs alone, and a hard-coded list would demand files ESLint never lints.
const lintableExtensions = report => new Set(report.map(entry => extname(toPosix(entry.filePath))))

const splitRequestedPaths = value =>
  value
    .split(/[,\n\r]+/)
    .map(entry => entry.trim())
    .filter(entry => entry !== '')

const runGit = (repoRoot, args) =>
  execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: GIT_OUTPUT_LIMIT,
    stdio: ['ignore', 'pipe', 'pipe']
  })

// Derived rather than asked for: a caller who forgets to name the files their change touched would otherwise be
// handed a gate that only checks the files the baseline already knew about, which is precisely how a new or renamed
// file slips out of the lint scope unnoticed. Failure to derive is an error, never a silent skip.
const deriveChangedPaths = (repoRoot, baseCommit) => {
  try {
    runGit(repoRoot, ['rev-parse', '--verify', '--quiet', `${baseCommit}^{commit}`])
  } catch {
    return {
      problem:
        `cannot resolve the recorded base commit ${baseCommit} in ${repoRoot}, so the files this change touched ` +
        'cannot be derived: fetch the commit into this checkout (a shallow clone does not hold it) or pass them ' +
        `with ${REQUIRE_FLAG}`
    }
  }

  try {
    const changed = runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', baseCommit, '--'])
    const untracked = runGit(repoRoot, ['ls-files', '--others', '--exclude-standard'])

    return {paths: [...new Set([...changed.split('\n'), ...untracked.split('\n')].map(line => line.trim()))]}
  } catch (error) {
    return {
      problem:
        `cannot list the files changed since ${baseCommit} in ${repoRoot}: ${error.message.trim()}; run the gate ` +
        `inside the repository or pass the changed files with ${REQUIRE_FLAG}`
    }
  }
}

const resolveRequiredPaths = (requestedPaths, changedFileCoverage, repoRoot) => {
  if (requestedPaths.length > 0) {
    return {paths: requestedPaths, origin: 'the caller'}
  }

  if (changedFileCoverage.source === CHANGED_SOURCE_CALLER) {
    return {paths: [], origin: CHANGED_SOURCE_CALLER}
  }

  const derived = deriveChangedPaths(repoRoot, changedFileCoverage.baseCommit)

  return derived.problem === undefined
    ? {paths: derived.paths, origin: `the working tree against ${changedFileCoverage.baseCommit}`}
    : derived
}

// A changed-file list is produced by git, which may run at the repository root or at a workspace root above it, and
// may be asked for absolute paths; all three forms name the same file to this gate.
const normalizeRequestedPath = (requested, repoRoot) => {
  const posixPath = toPosix(requested).replace(/^\.\//, '')
  const rootPrefix = `${repoRoot}/`

  if (posixPath.startsWith(rootPrefix)) {
    return posixPath.slice(rootPrefix.length)
  }

  const repoDirPrefix = `${basename(repoRoot)}/`

  if (posixPath.startsWith(repoDirPrefix) && existsSync(resolve(repoRoot, posixPath.slice(repoDirPrefix.length)))) {
    return posixPath.slice(repoDirPrefix.length)
  }

  return posixPath.replace(/^\/+/, '')
}

const splitByExistence = (relativePaths, repoRoot) => {
  const present = []
  const absent = []

  for (const relativePath of relativePaths) {
    const bucket = existsSync(resolve(repoRoot, relativePath)) ? present : absent

    bucket.push(relativePath)
  }

  return {present: present.sort(compareStrings), absent: absent.sort(compareStrings)}
}

// The after report passes only if it covered what it had to cover. Expected = the files the baseline covered that a
// lint run today would still meet on disk; anything the baseline covered that is gone was deleted or renamed and is
// reported instead of demanded.
const assessCoverage = (baselinePaths, afterPaths, repoRoot) => {
  const {present, absent} = splitByExistence([...baselinePaths], repoRoot)

  return {
    expected: present,
    removed: absent,
    uncovered: present.filter(relativePath => !afterPaths.has(relativePath))
  }
}

const assessRequested = (requestedPaths, afterPaths, extensions, repoRoot) => {
  const normalized = [...new Set(requestedPaths.map(requested => normalizeRequestedPath(requested, repoRoot)))]
  const outOfScope = normalized.filter(relativePath => !extensions.has(extname(relativePath)))
  const lintable = normalized.filter(relativePath => extensions.has(extname(relativePath)))
  const {present, absent} = splitByExistence(lintable, repoRoot)

  return {
    outOfScope: outOfScope.sort(compareStrings),
    removed: absent,
    covered: present.filter(relativePath => afterPaths.has(relativePath)),
    missing: present.filter(relativePath => !afterPaths.has(relativePath))
  }
}

const formatPathList = relativePaths => {
  const listed = relativePaths.slice(0, MAX_LISTED_PATHS).map(relativePath => `  ${relativePath}`)
  const hidden = relativePaths.length - listed.length

  return hidden > 0 ? [...listed, `  … and ${hidden} more`].join('\n') : listed.join('\n')
}

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

const parseArguments = argv => {
  const positional = []
  const requested = []
  let project = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === PROJECT_FLAG) {
      project = true
    } else if (argument === REQUIRE_FLAG) {
      const value = argv[index + 1]

      if (value === undefined) {
        return {problem: `${REQUIRE_FLAG} needs a comma- or newline-separated list of repo-relative paths`}
      }

      requested.push(...splitRequestedPaths(value))
      index += 1
    } else if (argument.startsWith('--')) {
      return {problem: `unknown option ${argument}`}
    } else {
      positional.push(argument)
    }
  }

  if (positional.length !== 2) {
    return {problem: 'two report paths are required'}
  }

  if (project && requested.length > 0) {
    return {problem: `${REQUIRE_FLAG} belongs to compare mode and cannot be combined with ${PROJECT_FLAG}`}
  }

  return {project, requested, positional}
}

const runProjectMode = (rawPath, outputPath, outputLabel) => {
  const rawLabel = `the raw ESLint report at ${rawPath}`
  const load = loadReport(rawLabel, rawPath)

  if (load.problem !== undefined) {
    reportInputProblem(load.problem)

    return
  }

  const shapeProblem = describeReportProblem(load.report, rawLabel)

  if (shapeProblem !== null) {
    reportInputProblem(shapeProblem)

    return
  }

  const dropped = countDroppedFields(load.report)
  const projected = projectResults(load.report)

  try {
    writeFileSync(outputPath, serializeReport(projected), 'utf8')
  } catch (error) {
    reportInputProblem(`cannot write the projected baseline to ${outputPath}: ${error.message}`)

    return
  }

  console.log(
    `${SCRIPT_NAME}: projected ${projected.length} result(s) into ${outputLabel} — elided file content from ` +
      `${dropped.results} result(s) and fix payloads from ${dropped.messages} message(s).`
  )
  console.log(
    `${SCRIPT_NAME}: save the record below as ${provenancePathFor(outputLabel)} and replace every null with the ` +
      'commit, time, working directory, scope and command the raw report was captured with:'
  )
  console.log(JSON.stringify(provenanceTemplate(projected, outputLabel), null, 2))
  process.exitCode = EXIT_OK
}

const runCompareMode = (baselinePath, afterPath, requestedPaths, repoRoot) => {
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

  const provenancePath = provenancePathFor(baselinePath)
  const provenanceLabel = `the provenance record at ${provenancePath}`
  const provenanceLoad = loadReport(provenanceLabel, provenancePath)

  if (provenanceLoad.problem !== undefined) {
    reportInputProblem(
      `${provenanceLoad.problem}; every baseline is compared against its record, so write one with ` +
        `"node scripts/${SCRIPT_NAME}.mjs ${PROJECT_FLAG} <raw-eslint.json> ${baselinePath}"`
    )

    return
  }

  const provenanceProblems = describeProvenanceProblems(provenanceLoad.report, baselineLoad.report, provenanceLabel)

  if (provenanceProblems.length > 0) {
    provenanceProblems.forEach(reportInputProblem)

    return
  }

  const required = resolveRequiredPaths(requestedPaths, provenanceLoad.report.changedFileCoverage, repoRoot)

  if (required.problem !== undefined) {
    reportInputProblem(required.problem)

    return
  }

  const baseline = tallyFindings(baselineLoad.report, repoRoot)
  const after = tallyFindings(afterLoad.report, repoRoot)
  const introduced = diffTallies(baseline.counts, after.occurrences)
  const coverage = assessCoverage(baseline.paths, after.paths, repoRoot)
  const requested = assessRequested(required.paths, after.paths, lintableExtensions(baselineLoad.report), repoRoot)
  const afterIsEmpty = afterLoad.report.length === 0

  if (baseline.occurrences.length === 0) {
    console.error(`${SCRIPT_NAME}: ${EMPTY_BASELINE_NOTE}`)
  }

  if (coverage.removed.length > 0) {
    console.error(
      `${SCRIPT_NAME}: ${coverage.removed.length} path(s) the baseline covers are no longer on disk and are not ` +
        'required of the after report'
    )
  }

  if (requested.removed.length > 0) {
    console.error(`${SCRIPT_NAME}: ${requested.removed.length} required path(s) no longer exist and were skipped`)
  }

  if (requested.outOfScope.length > 0) {
    console.error(
      `${SCRIPT_NAME}: ${requested.outOfScope.length} required path(s) sit outside the lint scope the baseline ` +
        'describes and were skipped'
    )
  }

  if (required.origin === CHANGED_SOURCE_CALLER) {
    console.error(
      `${SCRIPT_NAME}: the record leaves the changed files to the caller and none were given, so only the paths ` +
        'the baseline already covers are required of the after report'
    )
  }

  const failed = introduced.length > 0 || afterIsEmpty || coverage.uncovered.length > 0 || requested.missing.length > 0

  if (!failed) {
    console.log(
      `${SCRIPT_NAME}: passed — 0 new findings (${after.occurrences.length} in the after report, ` +
        `${baseline.occurrences.length} in the baseline); the after report's ${after.paths.size} result(s) cover ` +
        `all ${coverage.expected.length} baseline path(s) still on disk and all ${requested.covered.length} ` +
        `changed lintable file(s) named by ${required.origin}. ${PASS_NOTE}`
    )
    process.exitCode = EXIT_OK

    return
  }

  if (introduced.length > 0) {
    introduced.forEach(occurrence => console.log(formatFinding(occurrence)))
    console.log(`${introduced.length} new lint finding(s) not present in the baseline.`)
    console.log(REMEDY)
  }

  if (afterIsEmpty) {
    console.log(`${SCRIPT_NAME}: ${EMPTY_AFTER_NOTE}.`)
  }

  if (coverage.uncovered.length > 0) {
    console.log(
      `${coverage.uncovered.length} file(s) the baseline covers are absent from the after report, which therefore ` +
        'cannot show whether they still lint clean:'
    )
    console.log(formatPathList(coverage.uncovered))
  }

  if (requested.missing.length > 0) {
    console.log(`${requested.missing.length} changed file(s) required of the after report are absent from it:`)
    console.log(formatPathList(requested.missing))
  }

  if (afterIsEmpty || coverage.uncovered.length > 0 || requested.missing.length > 0) {
    console.log(COVERAGE_REMEDY)
  }

  process.exitCode = EXIT_GATE_FAILED
}

const main = scriptUrl => {
  const parsed = parseArguments(process.argv.slice(2))

  if (parsed.problem !== undefined) {
    console.error(`${SCRIPT_NAME}: ${parsed.problem}`)
    console.error(USAGE)
    process.exitCode = EXIT_USAGE

    return
  }

  const [firstPath, secondPath] = parsed.positional.map(argument => resolve(process.cwd(), argument))

  if (parsed.project) {
    runProjectMode(firstPath, secondPath, parsed.positional[1])

    return
  }

  runCompareMode(firstPath, secondPath, parsed.requested, repoRootFromScriptUrl(scriptUrl))
}

main(import.meta.url)
