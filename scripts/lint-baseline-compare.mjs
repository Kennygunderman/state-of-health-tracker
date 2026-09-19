// Repository tooling kept as a dependency-free .mjs so this gate also runs on a checkout with no node_modules:
// every import is a node: builtin and git is reached with spawnSync rather than through a library.
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, extname, join, resolve} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

const SCRIPT_NAME = 'lint-baseline-compare'
const KEY_SEPARATOR = '\u0000'
const FATAL_RULE_SENTINEL = '(fatal)'
const EXIT_OK = 0
const EXIT_GATE_FAILED = 1
const EXIT_USAGE = 2

// Display metadata, not part of a finding's identity: absent is allowed and normalises to 0, a wrong type is not.
const POSITION_FIELDS = ['line', 'column']

const OPTION_PROJECT = '--project'
const OPTION_REQUIRE = '--require'

// The capture record is resolved from the baseline path instead of being passed in, so the pairing cannot be
// forgotten by a caller or pointed at a record that describes some other capture.
const JSON_SUFFIX = '.json'
const PROVENANCE_SUFFIX = '.provenance.json'
const DIGEST_ALGORITHM = 'sha256'
const DIGEST_PATTERN = /^[0-9a-f]{64}$/
const TOTAL_FIELDS = ['lintedFiles', 'filesWithFindings', 'findings', 'errors', 'warnings']
const COMPOSITION_COUNT_FIELDS = ['fatalFindings', 'filesWithFindingsOutsideSrc', 'findingsOutsideSrc']
const SOURCE_PREFIX = 'src/'
const ERROR_SEVERITY = 2
const WARNING_SEVERITY = 1

// ESLint embeds the linted file's own text in these fields, which is why the committed artifact is a projection of
// the raw capture and why the digest is taken over the projected form: one capture hashes the same either way.
const DROPPED_RESULT_FIELDS = ['source', 'output']
const DROPPED_MESSAGE_FIELDS = ['fix', 'suggestions']
const MESSAGE_LIST_FIELDS = ['messages', 'suppressedMessages']

// ESLint's ignore configuration decides which changed files a full run can be expected to cover. It is read from
// the two files that declare it because this gate cannot load ESLint itself: .eslintignore is a plain list, and
// .eslintrc.js is JavaScript, so only its ignorePatterns array is lifted out textually.
const ESLINT_IGNORE_FILE = '.eslintignore'
const ESLINT_CONFIG_FILE = '.eslintrc.js'
const IGNORE_PATTERNS_EXPRESSION = /ignorePatterns\s*:\s*\[([^\]]*)\]/
const QUOTED_STRING_EXPRESSION = /'([^']*)'|"([^"]*)"/g
const COMMENT_PREFIX = '#'
const NEGATION_PREFIX = '!'
const MAX_LISTED_PATHS = 20

const USAGE = [
  'Usage: node scripts/lint-baseline-compare.mjs [--require <list>] <baseline.json> <after.json>',
  '       node scripts/lint-baseline-compare.mjs --project <capture.json> <projected.json>',
  '',
  'Compare mode reads two ESLint JSON reports (npx eslint --no-fix -f json . -o <file>) and fails on findings',
  'absent from the baseline. Findings are matched by repo-relative file path, rule id and message, so the two',
  'reports may come from different checkout roots.',
  '',
  'The baseline is accepted only while the capture record beside it describes it: <baseline>.provenance.json must',
  'carry the sha256 digest of the capture, its totals and — when it states them — its composition. A regenerated',
  'or hand-edited baseline is refused rather than compared, so it cannot pass by describing itself.',
  '',
  'Coverage fails closed. Every baseline path still on disk must appear in the after report, and so must every',
  "lintable file changed since the record's changedFileCoverage.baseCommit, derived here from git: tracked",
  'changes against that commit plus untracked files, filtered to the extensions the baseline covers, to paths',
  'that exist on disk, and to what ESLint does not ignore. --require <list> replaces that derivation with a',
  'newline-delimited list for a caller that already holds one (an empty list drops the changed-file requirement,',
  'never the baseline one); the same filters apply to it.',
  '',
  'Projection mode writes the baseline artifact from a raw capture. ESLint embeds the linted file in source,',
  'output, fix and suggestions, so those four fields are elided before a capture is committed; everything the',
  'comparison keys on survives and the projection hashes to the same digest as the capture it came from.',
  '',
  'Compare mode is read-only over its inputs — it never writes a file and never "fixes" anything. Projection mode',
  'writes exactly the destination it is given.',
  '',
  'Exit codes:',
  '  0  the gate passed — every finding in the after report is matched by the baseline, and coverage is complete',
  '  1  the gate failed — a finding absent from the baseline, one exceeding its baseline occurrence count, or a',
  '     path the after report lost',
  '  2  unusable input — wrong arguments, an unreadable path, malformed JSON, a wrong report shape, a capture',
  '     record that does not describe the baseline, or a changed-file list that cannot be derived',
  '',
  'A report whose results all sit inside one deep directory carries no repository-root-level file to anchor on, so',
  'its common directory prefix is that directory; reports produced by "eslint ." always include root-level files',
  'such as .eslintrc.js and are unaffected.'
].join('\n')

const PASS_NOTE =
  '"eslint ." itself still exits non-zero while those baseline findings remain; that exit code is not this gate.'

const REMEDY =
  'Fix the new findings in the files you changed — do not edit untouched files and do not regenerate the baseline.'

const EMPTY_AFTER_NOTE =
  'the after report holds no results at all, so the lint run behind it linted no file and carries no finding to' +
  ' match against the baseline'

const EMPTY_BASELINE_NOTE = [
  'the baseline report holds 0 findings, which usually means it was not captured from the pristine base commit;',
  'every finding in the after report is therefore counted as new'
].join(' ')

const RECORD_HINT = [
  'The gate refuses a baseline no capture record describes, so a regenerated or hand-edited artifact cannot pass',
  'unnoticed. A genuine recapture is "npx eslint --no-fix -f json . -o <capture>", then',
  `"node scripts/lint-baseline-compare.mjs ${OPTION_PROJECT} <capture> <baseline>", then the digest, totals and`,
  'composition that command prints written into the record beside the baseline in the same reviewed commit.'
].join(' ')

const COVERAGE_REMEDY = [
  'Lint the whole repository into the after report ("npx eslint --no-fix -f json . -o <file>") so every path the',
  'gate measures is present: a report that lints fewer files holds fewer findings and would otherwise pass. Use',
  `${OPTION_REQUIRE} <list> only when you already hold the changed-file list.`
].join(' ')

const SHALLOW_CLONE_NOTE =
  'a checkout that cannot resolve that commit (a shallow clone) is an error, not a skipped check: deepen the' +
  ` clone, or pass ${OPTION_REQUIRE} <list> when you already hold the changed-file list`

const LOST_BASELINE_REASON = 'baseline path, still on disk'

const changedSinceReason = baseCommit => `changed since ${baseCommit}`

const requiredListReason = listPath => `required by ${listPath}`

const coverageFailureHeadline = count =>
  `coverage failed — ${count} path(s) the gate measures do not appear in the after report, so it cannot say` +
  ' whether they lint clean'

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

const isPosition = value => Number.isFinite(value) && value >= 0

const describeMessageProblem = (message, filePath, label) => {
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    return `${label} holds a non-object message for ${filePath}`
  }

  if (typeof message.message !== 'string') {
    return `${label} holds a message without a string "message" for ${filePath}`
  }

  // A rule id is the second third of a finding's identity and a fatal message states it as null, so an absent or
  // wrongly typed one cannot be allowed to collapse into the fatal sentinel and match a real parse error.
  if (!Object.hasOwn(message, 'ruleId')) {
    return `${label} holds a message without a "ruleId" for ${filePath}`
  }

  if (message.ruleId !== null && typeof message.ruleId !== 'string') {
    return `${label} holds a message whose "ruleId" is neither a string nor null for ${filePath}`
  }

  for (const field of POSITION_FIELDS) {
    if (message[field] !== undefined && !isPosition(message[field])) {
      return `${label} holds a message whose "${field}" is not a non-negative number for ${filePath}`
    }
  }

  if (message.severity !== undefined && typeof message.severity !== 'number') {
    return `${label} holds a message whose "severity" is not a number for ${filePath}`
  }

  return null
}

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

    // Required rather than defaulted to []: a report that keeps every linted path and drops the message arrays
    // holds no finding to compare and would otherwise pass this gate as "0 new findings".
    if (!Object.hasOwn(entry, 'messages')) {
      return `${label} holds a result without a "messages" array for ${entry.filePath}`
    }

    if (!Array.isArray(entry.messages)) {
      return `${label} holds a non-array "messages" for ${entry.filePath}`
    }

    if (Object.hasOwn(entry, 'suppressedMessages') && !Array.isArray(entry.suppressedMessages)) {
      return `${label} holds a non-array "suppressedMessages" for ${entry.filePath}`
    }

    for (const message of entry.messages) {
      const problem = describeMessageProblem(message, entry.filePath, label)

      if (problem !== null) {
        return problem
      }
    }
  }

  return null
}

const relativePathsOf = (report, localRoot) => {
  const posixFilePaths = report.map(entry => toPosix(entry.filePath))
  const reportRoot = resolveReportRoot(posixFilePaths, localRoot)

  return posixFilePaths.map(posixFilePath => normalizePath(posixFilePath, reportRoot))
}

const tallyFindings = (report, localRoot) => {
  const relativePaths = relativePathsOf(report, localRoot)
  const occurrences = []
  const counts = new Map()
  const paths = new Set()

  report.forEach((entry, index) => {
    const relativePath = relativePaths[index]

    paths.add(relativePath)

    for (const message of entry.messages) {
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

const messagesOf = entry => MESSAGE_LIST_FIELDS.flatMap(field => (Array.isArray(entry[field]) ? entry[field] : []))

const tallyTotals = report => {
  const totals = {lintedFiles: report.length, filesWithFindings: 0, findings: 0, errors: 0, warnings: 0}

  for (const entry of report) {
    if (entry.messages.length > 0) {
      totals.filesWithFindings += 1
    }

    totals.findings += entry.messages.length

    for (const message of entry.messages) {
      if (message.severity === ERROR_SEVERITY) {
        totals.errors += 1
      }

      if (message.severity === WARNING_SEVERITY) {
        totals.warnings += 1
      }
    }
  }

  return totals
}

const tallyComposition = (report, relativePaths) => {
  const composition = {
    fatalFindings: 0,
    filesWithFindingsOutsideSrc: 0,
    findingsOutsideSrc: 0,
    findingsByRule: {}
  }

  report.forEach((entry, index) => {
    if (entry.messages.length === 0) {
      return
    }

    if (!relativePaths[index].startsWith(SOURCE_PREFIX)) {
      composition.filesWithFindingsOutsideSrc += 1
      composition.findingsOutsideSrc += entry.messages.length
    }

    for (const message of entry.messages) {
      const rule = ruleLabel(message.ruleId)

      if (rule === FATAL_RULE_SENTINEL) {
        composition.fatalFindings += 1
      }

      composition.findingsByRule[rule] = (composition.findingsByRule[rule] ?? 0) + 1
    }
  })

  return composition
}

// Ordered the way a reader of the record wants it — busiest rule first — which is why the record's rule counts are
// compared key by key rather than as a serialised object.
const sortCountsByDescendingCount = composition => ({
  ...composition,
  findingsByRule: Object.fromEntries(
    Object.entries(composition.findingsByRule).sort(
      ([leftRule, leftCount], [rightRule, rightCount]) => rightCount - leftCount || compareStrings(leftRule, rightRule)
    )
  )
})

// Object.entries preserves insertion order and Object.fromEntries keeps it, so projecting a capture that already
// carries none of the dropped fields reproduces it field for field — which is what lets one capture hash the same
// in its raw and projected forms.
const withoutFields = (record, fields) =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !fields.includes(field)))

const projectMessages = messages => messages.map(message => withoutFields(message, DROPPED_MESSAGE_FIELDS))

const projectResult = entry => {
  const projected = withoutFields(entry, DROPPED_RESULT_FIELDS)

  for (const field of MESSAGE_LIST_FIELDS) {
    if (Array.isArray(projected[field])) {
      projected[field] = projectMessages(projected[field])
    }
  }

  return projected
}

const projectReport = report => report.map(projectResult)

const digestOf = report =>
  createHash(DIGEST_ALGORITHM)
    .update(JSON.stringify(projectReport(report)))
    .digest('hex')

const countElisions = report => {
  const counts = Object.fromEntries([...DROPPED_RESULT_FIELDS, ...DROPPED_MESSAGE_FIELDS].map(field => [field, 0]))

  for (const entry of report) {
    for (const field of DROPPED_RESULT_FIELDS) {
      if (Object.hasOwn(entry, field)) {
        counts[field] += 1
      }
    }

    for (const message of messagesOf(entry)) {
      for (const field of DROPPED_MESSAGE_FIELDS) {
        if (message !== null && typeof message === 'object' && Object.hasOwn(message, field)) {
          counts[field] += 1
        }
      }
    }
  }

  return counts
}

const isCountRecord = value =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every(count => Number.isFinite(count))

const describeRecordProblem = (record, label) => {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return `${label} is not a capture record: expected an object, found ${describeType(record)}`
  }

  const {digest, totals, changedFileCoverage, composition} = record

  if (digest === null || typeof digest !== 'object' || Array.isArray(digest)) {
    return `${label} holds no "digest" object`
  }

  if (digest.algorithm !== DIGEST_ALGORITHM) {
    return `${label} states digest.algorithm ${JSON.stringify(digest.algorithm)} rather than "${DIGEST_ALGORITHM}"`
  }

  if (typeof digest.value !== 'string' || !DIGEST_PATTERN.test(digest.value)) {
    return `${label} holds no ${DIGEST_ALGORITHM} digest.value`
  }

  if (totals === null || typeof totals !== 'object' || Array.isArray(totals)) {
    return `${label} holds no "totals" object`
  }

  for (const field of TOTAL_FIELDS) {
    if (!Number.isFinite(totals[field])) {
      return `${label} holds no numeric totals.${field}`
    }
  }

  if (changedFileCoverage === null || typeof changedFileCoverage !== 'object' || Array.isArray(changedFileCoverage)) {
    return `${label} holds no "changedFileCoverage" object`
  }

  if (typeof changedFileCoverage.baseCommit !== 'string' || changedFileCoverage.baseCommit.trim() === '') {
    return `${label} holds no changedFileCoverage.baseCommit for the changed-file derivation`
  }

  if (composition === undefined) {
    return null
  }

  if (composition === null || typeof composition !== 'object' || Array.isArray(composition)) {
    return `${label} holds a "composition" that is not an object`
  }

  for (const field of COMPOSITION_COUNT_FIELDS) {
    if (composition[field] !== undefined && !Number.isFinite(composition[field])) {
      return `${label} holds a non-numeric composition.${field}`
    }
  }

  if (composition.findingsByRule !== undefined && !isCountRecord(composition.findingsByRule)) {
    return `${label} holds a composition.findingsByRule that is not a record of counts`
  }

  return null
}

const describeCountDifferences = (recorded, measured, fields, prefix) =>
  fields
    .filter(field => recorded[field] !== undefined && recorded[field] !== measured[field])
    .map(field => `${prefix}${field} ${recorded[field]} rather than ${measured[field]}`)

const describeCompositionDifferences = (recorded, measured) => {
  const differences = describeCountDifferences(recorded, measured, COMPOSITION_COUNT_FIELDS, 'composition.')

  if (recorded.findingsByRule === undefined) {
    return differences
  }

  const rules = [...new Set([...Object.keys(recorded.findingsByRule), ...Object.keys(measured.findingsByRule)])]

  // Compared rule by rule rather than as serialised objects: the record lists rules in descending count order, so
  // an object comparison would fail on key order alone.
  for (const rule of rules.sort(compareStrings)) {
    const recordedCount = recorded.findingsByRule[rule] ?? 0
    const measuredCount = measured.findingsByRule[rule] ?? 0

    if (recordedCount !== measuredCount) {
      differences.push(`composition.findingsByRule["${rule}"] ${recordedCount} rather than ${measuredCount}`)
    }
  }

  return differences
}

const describeRecordMismatch = (record, report, relativePaths, label) => {
  const digest = digestOf(report)

  if (digest !== record.digest.value) {
    return (
      `${label} describes a capture whose ${DIGEST_ALGORITHM} digest is ${record.digest.value}, but this` +
      ` baseline hashes to ${digest}`
    )
  }

  const differences = [
    ...describeCountDifferences(record.totals, tallyTotals(report), TOTAL_FIELDS, 'totals.'),
    ...(record.composition === undefined
      ? []
      : describeCompositionDifferences(record.composition, tallyComposition(report, relativePaths)))
  ]

  if (differences.length > 0) {
    return `${label} records ${differences.join(', ')}`
  }

  return null
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

const provenancePathFor = baselinePath =>
  baselinePath.endsWith(JSON_SUFFIX)
    ? `${baselinePath.slice(0, -JSON_SUFFIX.length)}${PROVENANCE_SUFFIX}`
    : `${baselinePath}${PROVENANCE_SUFFIX}`

const readTextFile = (label, filePath) => {
  try {
    return {text: readFileSync(filePath, 'utf8')}
  } catch (error) {
    return {problem: `cannot read ${label}: ${error.message}`}
  }
}

const loadJson = (label, filePath) => {
  const read = readTextFile(label, filePath)

  if (read.problem !== undefined) {
    return {problem: read.problem}
  }

  try {
    return {value: JSON.parse(read.text)}
  } catch (error) {
    return {problem: `${label} is not valid JSON: ${error.message}`}
  }
}

const loadReport = (label, filePath) => {
  const loaded = loadJson(label, filePath)

  return loaded.problem === undefined ? {report: loaded.value} : {problem: loaded.problem}
}

const listOf = text =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith(COMMENT_PREFIX))

const ignorePatternsOf = repoRoot => {
  const fromIgnoreFile = readTextFile(ESLINT_IGNORE_FILE, join(repoRoot, ESLINT_IGNORE_FILE))
  const fromConfigFile = readTextFile(ESLINT_CONFIG_FILE, join(repoRoot, ESLINT_CONFIG_FILE))
  const patterns = fromIgnoreFile.text === undefined ? [] : listOf(fromIgnoreFile.text)
  const declared = fromConfigFile.text === undefined ? null : IGNORE_PATTERNS_EXPRESSION.exec(fromConfigFile.text)

  if (declared !== null) {
    for (const match of declared[1].matchAll(QUOTED_STRING_EXPRESSION)) {
      patterns.push(match[1] ?? match[2])
    }
  }

  return patterns.map(pattern => pattern.trim()).filter(pattern => pattern !== '')
}

// Enough of the gitignore syntax ESLint's ignore files use to classify a path: a pattern without a slash matches
// at any depth, one with a slash is anchored at the root, a trailing slash matches the directory's contents, and a
// later negation re-includes what an earlier pattern excluded.
const ignoreExpressionFor = pattern => {
  const body = pattern.replace(/^\/+/, '').replace(/\/+$/, '')
  const anchored = body.includes('/')
  const translated = body
    .split('/')
    .map(segment =>
      segment
        .split('**')
        .map(part =>
          part
            .split('*')
            .map(literal => literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('[^/]*')
        )
        .join('.*')
    )
    .join('/')

  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${translated}(?:/.*)?$`)
}

const isIgnoredPath = (relativePath, patterns) => {
  let ignored = false

  for (const pattern of patterns) {
    const negated = pattern.startsWith(NEGATION_PREFIX)
    const body = negated ? pattern.slice(NEGATION_PREFIX.length) : pattern

    if (body !== '' && ignoreExpressionFor(body).test(relativePath)) {
      ignored = !negated
    }
  }

  return ignored
}

const gitLines = (repoRoot, args) => {
  const command = `git ${args.join(' ')}`
  const result = spawnSync('git', ['-C', repoRoot, ...args], {encoding: 'utf8'})

  if (result.error !== undefined && result.error !== null) {
    return {problem: `cannot run "${command}": ${result.error.message}`}
  }

  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim()

    return {problem: `"${command}" failed${detail === '' ? ` with exit ${result.status}` : `: ${detail}`}`}
  }

  return {lines: listOf(result.stdout ?? '')}
}

// The changed-file list is derived here rather than taken on trust, because a file this change added is absent
// from the baseline and would otherwise be free to drop out of the lint scope unnoticed.
const deriveChangedPaths = (repoRoot, baseCommit) => {
  const resolved = gitLines(repoRoot, ['rev-parse', '--verify', `${baseCommit}^{commit}`])

  if (resolved.problem !== undefined) {
    return {
      problem: `cannot resolve the capture record's baseCommit ${baseCommit}: ${resolved.problem} — ${SHALLOW_CLONE_NOTE}`
    }
  }

  const tracked = gitLines(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', baseCommit])

  if (tracked.problem !== undefined) {
    return {problem: tracked.problem}
  }

  const untracked = gitLines(repoRoot, ['ls-files', '--others', '--exclude-standard'])

  if (untracked.problem !== undefined) {
    return {problem: untracked.problem}
  }

  return {paths: [...tracked.lines, ...untracked.lines], reason: changedSinceReason(baseCommit)}
}

const readRequiredPaths = listPath => {
  const read = readTextFile(`the ${OPTION_REQUIRE} list at ${listPath}`, listPath)

  return read.problem === undefined
    ? {paths: listOf(read.text).map(toPosix), reason: requiredListReason(listPath)}
    : {problem: read.problem}
}

// A candidate only counts when a full "eslint ." run would actually have reported it: the extensions come from the
// baseline capture instead of an assumed set, a path that no longer exists cannot be linted, and ESLint's own
// ignore configuration decides the rest.
const selectLintablePaths = (candidates, {repoRoot, extensions, ignorePatterns}) => {
  const selected = []

  for (const candidate of new Set(candidates.map(entry => normalizePath(toPosix(entry), repoRoot)))) {
    const lintable =
      extensions.has(extname(candidate)) &&
      !isIgnoredPath(candidate, ignorePatterns) &&
      existsSync(join(repoRoot, candidate))

    if (lintable) {
      selected.push(candidate)
    }
  }

  return selected.sort(compareStrings)
}

const lintableExtensionsOf = report => new Set(report.map(entry => extname(toPosix(entry.filePath))))

const findCoverageGaps = ({baselinePaths, changedPaths, afterPaths, repoRoot}) => {
  const lost = [...baselinePaths]
    .filter(relativePath => !afterPaths.has(relativePath) && existsSync(join(repoRoot, relativePath)))
    .sort(compareStrings)
  const lostSet = new Set(lost)
  const uncovered = changedPaths.filter(relativePath => !afterPaths.has(relativePath) && !lostSet.has(relativePath))

  return {lost, uncovered}
}

const formatCoverageGap = (relativePath, reason) => `  ${relativePath}  (${reason})`

const reportInputProblem = problem => {
  console.error(`${SCRIPT_NAME}: ${problem}`)
  process.exitCode = EXIT_USAGE
}

const refuseBaseline = problem => {
  reportInputProblem(problem)
  console.error(RECORD_HINT)
}

const failCoverage = lines => {
  lines.forEach(line => console.log(line))
  console.log(COVERAGE_REMEDY)
  process.exitCode = EXIT_GATE_FAILED
}

const listCoverageGaps = ({lost, uncovered}, changedReason) => {
  const gaps = [
    ...lost.map(relativePath => formatCoverageGap(relativePath, LOST_BASELINE_REASON)),
    ...uncovered.map(relativePath => formatCoverageGap(relativePath, changedReason))
  ]

  return gaps.length > MAX_LISTED_PATHS
    ? [...gaps.slice(0, MAX_LISTED_PATHS), `  … and ${gaps.length - MAX_LISTED_PATHS} more`]
    : gaps
}

const parseArguments = argv => {
  const positional = []
  let project = false
  let requiredList = null

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === OPTION_PROJECT) {
      project = true

      continue
    }

    if (argument === OPTION_REQUIRE || argument.startsWith(`${OPTION_REQUIRE}=`)) {
      const inline = argument.startsWith(`${OPTION_REQUIRE}=`)
      const value = inline ? argument.slice(OPTION_REQUIRE.length + 1) : argv[index + 1]

      if (value === undefined || value === '' || value.startsWith('--')) {
        return {problem: `${OPTION_REQUIRE} needs the path of a file listing one changed file per line`}
      }

      requiredList = value
      index += inline ? 0 : 1

      continue
    }

    if (argument.startsWith('--')) {
      return {problem: `unknown option ${argument}`}
    }

    positional.push(argument)
  }

  if (project && requiredList !== null) {
    return {problem: `${OPTION_REQUIRE} belongs to the comparison, not to ${OPTION_PROJECT}`}
  }

  if (positional.length !== 2) {
    return {
      problem: project
        ? `${OPTION_PROJECT} takes the raw capture to project and the path to write the projection to`
        : 'exactly two report paths are required'
    }
  }

  return {project, positional, requiredList}
}

// The record is an input, not documentation: a baseline it does not describe is refused before any comparison, so a
// regenerated or hand-edited artifact cannot quietly shrink what the gate measures.
const verifyAgainstRecord = (baselinePath, report, relativePaths) => {
  const recordPath = provenancePathFor(baselinePath)
  const label = `the capture record at ${recordPath}`
  const load = loadJson(label, recordPath)

  if (load.problem !== undefined) {
    return {problem: `${load.problem} — the gate accepts only a baseline described by a capture record beside it`}
  }

  const shapeProblem = describeRecordProblem(load.value, label)

  if (shapeProblem !== null) {
    return {problem: shapeProblem}
  }

  const mismatch = describeRecordMismatch(load.value, report, relativePaths, label)

  return mismatch === null ? {record: load.value} : {problem: mismatch}
}

const resolveCoverageTargets = ({record, requiredList, localRoot, baselineReport}) => {
  const candidates =
    requiredList === null
      ? deriveChangedPaths(localRoot, record.changedFileCoverage.baseCommit)
      : readRequiredPaths(requiredList)

  if (candidates.problem !== undefined) {
    return {problem: candidates.problem}
  }

  return {
    reason: candidates.reason,
    paths: selectLintablePaths(candidates.paths, {
      repoRoot: localRoot,
      extensions: lintableExtensionsOf(baselineReport),
      ignorePatterns: ignorePatternsOf(localRoot)
    })
  }
}

const runCompareMode = ({baselinePath, afterPath, requiredList, localRoot}) => {
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

  const baselinePaths = relativePathsOf(baselineLoad.report, localRoot)
  const verified = verifyAgainstRecord(baselinePath, baselineLoad.report, baselinePaths)

  if (verified.problem !== undefined) {
    refuseBaseline(verified.problem)

    return
  }

  const coverage = resolveCoverageTargets({
    record: verified.record,
    requiredList,
    localRoot,
    baselineReport: baselineLoad.report
  })

  if (coverage.problem !== undefined) {
    reportInputProblem(coverage.problem)

    return
  }

  const baseline = tallyFindings(baselineLoad.report, localRoot)
  const after = tallyFindings(afterLoad.report, localRoot)

  if (baseline.occurrences.length === 0) {
    console.error(`${SCRIPT_NAME}: ${EMPTY_BASELINE_NOTE}`)
  }

  if (afterLoad.report.length === 0) {
    console.error(`${SCRIPT_NAME}: ${EMPTY_AFTER_NOTE}`)
    failCoverage([`${SCRIPT_NAME}: coverage failed — ${EMPTY_AFTER_NOTE}`])

    return
  }

  const gaps = listCoverageGaps(
    findCoverageGaps({
      baselinePaths: baseline.paths,
      changedPaths: coverage.paths,
      afterPaths: after.paths,
      repoRoot: localRoot
    }),
    coverage.reason
  )

  if (gaps.length > 0) {
    failCoverage([`${SCRIPT_NAME}: ${coverageFailureHeadline(gaps.length)}`, ...gaps])

    return
  }

  const introduced = diffTallies(baseline.counts, after.occurrences)

  if (introduced.length === 0) {
    console.log(
      `${SCRIPT_NAME}: passed — 0 new findings (${after.occurrences.length} in the after report, ` +
        `${baseline.occurrences.length} in the baseline) across the after report's ${after.paths.size} ` +
        `result(s). ${PASS_NOTE}`
    )
    process.exitCode = EXIT_OK

    return
  }

  introduced.forEach(occurrence => console.log(formatFinding(occurrence)))
  console.log(`${introduced.length} new lint finding(s) not present in the baseline.`)
  console.log(REMEDY)
  process.exitCode = EXIT_GATE_FAILED
}

const runProjectMode = (capturePath, destinationPath, localRoot) => {
  const label = `the capture at ${capturePath}`
  const load = loadReport(label, capturePath)

  if (load.problem !== undefined) {
    reportInputProblem(load.problem)

    return
  }

  const shapeProblem = describeReportProblem(load.report, label)

  if (shapeProblem !== null) {
    reportInputProblem(shapeProblem)

    return
  }

  const elisions = countElisions(load.report)

  try {
    // Compact and newline-free, exactly as "eslint -o" writes it, so the projection's bytes are the digest's input.
    writeFileSync(destinationPath, JSON.stringify(projectReport(load.report)), 'utf8')
  } catch (error) {
    reportInputProblem(`cannot write the projection to ${destinationPath}: ${error.message}`)

    return
  }

  console.log(
    `${SCRIPT_NAME}: projected ${load.report.length} result(s) into ${destinationPath}, eliding ` +
      `${Object.entries(elisions)
        .map(([field, count]) => `${count} ${field}`)
        .join(', ')}.`
  )
  console.log(`${SCRIPT_NAME}: paste the block below into the capture record beside the baseline.`)
  console.log(
    JSON.stringify(
      {
        digest: {algorithm: DIGEST_ALGORITHM, value: digestOf(load.report)},
        totals: tallyTotals(load.report),
        composition: sortCountsByDescendingCount(tallyComposition(load.report, relativePathsOf(load.report, localRoot)))
      },
      null,
      2
    )
  )
  process.exitCode = EXIT_OK
}

const main = scriptUrl => {
  const parsed = parseArguments(process.argv.slice(2))

  if (parsed.problem !== undefined) {
    console.error(`${SCRIPT_NAME}: ${parsed.problem}`)
    console.error(USAGE)
    process.exitCode = EXIT_USAGE

    return
  }

  const localRoot = repoRootFromScriptUrl(scriptUrl)
  const [first, second] = parsed.positional.map(argument => resolve(process.cwd(), argument))

  if (parsed.project) {
    runProjectMode(first, second, localRoot)

    return
  }

  runCompareMode({
    baselinePath: first,
    afterPath: second,
    requiredList: parsed.requiredList === null ? null : resolve(process.cwd(), parsed.requiredList),
    localRoot
  })
}

main(import.meta.url)
