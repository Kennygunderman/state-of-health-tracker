// Both gates in scripts/ run under bare `node`, outside Babel, Metro and the TypeScript program, so they are
// written as `.mjs` and a test can only reach them the way a CI step does: by spawning them as child processes
// and reading the exit code and output. That is what this suite does. The suite itself is ordinary TypeScript,
// collected by the same `**/__tests__/**` pattern that collects every other one, and the two ESLint report
// shapes its fixtures build are declared below instead of being assumed field by field.
//
// Both scripts/ gates are covered here rather than in one suite each: the token scan's own specification gives it
// no suite file, so its classification rules are pinned in the one suite the plan tracks for this folder.
import {spawnSync, type SpawnSyncReturns} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import process from 'node:process'

// One message as both reports carry it. `ruleId` is null on a fatal parse error, and a message reported at no
// position carries neither `line` nor `column` — the comparator treats both as ordinary findings, so the type
// has to admit them rather than force a fixture to invent values.
interface LintMessage {
  ruleId: string | null
  severity: number
  message: string
  line?: number
  column?: number
}

// One result entry. `errorCount`, `warningCount` and `suppressedMessages` are optional because several fixtures
// below deliberately omit them to prove the gate never assumes a field it was not given.
interface LintResult {
  filePath: string
  messages: LintMessage[]
  errorCount?: number
  warningCount?: number
  suppressedMessages?: LintMessage[]
}

// A result before it is rooted: the fixtures pair a repo-relative path with the messages it should carry, and
// `makeReport` prefixes one of the two absolute roots.
interface FileFixture {
  relativePath: string
  messages: LintMessage[]
}

interface ReportTotals {
  lintedFiles: number
  filesWithFindings: number
  findings: number
  errors: number
  warnings: number
}

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'lint-baseline-compare.mjs')
const TOKEN_SCAN_PATH = path.resolve(process.cwd(), 'scripts', 'token-literal-scan.mjs')
const TRACKED_BASELINE = path.resolve(process.cwd(), 'docs', 'lint-baseline.json')
const TRACKED_PROVENANCE = path.resolve(process.cwd(), 'docs', 'lint-baseline.provenance.json')
const SCANNED_STYLE_FILE = 'src/screens/RecipeDetail/index.styled.ts'

const REASON_COLOR = '(hardcoded color)'
const REASON_FONT_WEIGHT_STRING = '(quoted numeric font weight)'
const REASON_NUMERIC = '(numeric literal)'
const REASON_NUMERIC_STRING = '(quoted numeric literal)'
const NOTHING_TO_SCAN_NOTE = 'no files passed, nothing to scan'
const CLEAN_SCAN_NOTE = 'no hardcoded style values found'
const REMEDY_LINE = 'Do not widen the exemption list in this scanner and do not add an ignore comment.'

// The comparator exists to match findings across checkout roots, so the fixtures are captured under two
// deliberately unrelated absolute roots: a CI runner and a developer laptop.
const CI_ROOT = '/home/runner/work/app/mobile'
const LAPTOP_ROOT = '/Users/dev/projects/app/mobile'

const EXIT_OK = 0
const EXIT_GATE_FAILED = 1
const EXIT_INPUT_ERROR = 2

const USAGE_LINE = 'Usage: node scripts/lint-baseline-compare.mjs [--require <list>] <baseline.json> <after.json>'
const PROJECT_USAGE_LINE = 'node scripts/lint-baseline-compare.mjs --project <capture.json> <projected.json>'
const STACK_FRAME = /\n\s+at\s/
const BASELINE_LABEL = 'the baseline report at'
const AFTER_LABEL = 'the after report at'
const NEW_FINDINGS_NOTE = 'new lint finding(s)'
const PASS_SUMMARY = 'passed — 0 new findings'
const EMPTY_AFTER_NOTE = 'the after report holds no results at all'
const EMPTY_BASELINE_NOTE = 'the baseline report holds 0 findings'
const COVERAGE_FAILURE_NOTE = 'path(s) the gate measures do not appear in the after report'
const COVERAGE_FAILED = 'coverage failed'
const LOST_BASELINE_REASON = '(baseline path, still on disk)'
const RECORD_LABEL = 'the capture record at'
const RECORD_REFUSAL_HINT = 'The gate refuses a baseline no capture record describes'
const PROVENANCE_SUFFIX = '.provenance.json'
const DIGEST_ALGORITHM = 'sha256'

// The commit the tracked record names, and one no checkout can resolve. The derivation is proven to run by
// failing on the second rather than by asserting a file list that every later commit would change.
const BASE_COMMIT = '603718ee'
const UNRESOLVABLE_COMMIT = '0'.repeat(40)

const ESLINTRC = '.eslintrc.js'
const BABEL_CONFIG = 'babel.config.js'
const SCRIPT_FILE = 'scripts/transform-imports.js'
const STYLE_FILE = 'src/screens/Macros/index.styled.ts'
const SHAPE_FILE_PATH = `${CI_ROOT}/${STYLE_FILE}`

const DROPPED_RESULT_FIELDS = ['source', 'output']
const DROPPED_MESSAGE_FIELDS = ['fix', 'suggestions']
const MESSAGE_LIST_FIELDS = ['messages', 'suppressedMessages']

const CONFIG_ERROR: LintMessage = {
  ruleId: '@typescript-eslint/no-var-requires',
  severity: 2,
  message: 'Require statement not part of import statement.',
  line: 3,
  column: 14
}

const CONFIG_WARNING: LintMessage = {
  ruleId: 'padding-line-between-statements',
  severity: 1,
  message: 'Expected blank line before this statement.',
  line: 7,
  column: 3
}

const SCRIPT_ERROR: LintMessage = {
  ruleId: '@typescript-eslint/no-var-requires',
  severity: 2,
  message: 'Require statement not part of import statement.',
  line: 1,
  column: 12
}

const STYLE_FATAL: LintMessage = {
  ruleId: null,
  severity: 2,
  message: 'Parsing error: Unexpected token',
  line: 42,
  column: 3
}

const ADDED_STYLE_ERROR: LintMessage = {
  ruleId: 'prettier/prettier',
  severity: 2,
  message: 'Delete trailing whitespace',
  line: 12,
  column: 5
}

const ADDED_SCRIPT_FATAL: LintMessage = {
  ruleId: null,
  severity: 2,
  message: 'Parsing error: Unexpected end of input',
  line: 88,
  column: 1
}

const BASELINE_FILES: FileFixture[] = [
  {relativePath: ESLINTRC, messages: [CONFIG_ERROR]},
  {relativePath: BABEL_CONFIG, messages: [CONFIG_WARNING]},
  {relativePath: SCRIPT_FILE, messages: [SCRIPT_ERROR]},
  {relativePath: STYLE_FILE, messages: [STYLE_FATAL]}
]

const CLEAN_FILES: FileFixture[] = BASELINE_FILES.map(file => ({relativePath: file.relativePath, messages: []}))

let fixtureDir = ''
let emptyChangedList = ''
const isolatedDirs: string[] = []

const countSeverity = (messages: LintMessage[], severity: number): number =>
  messages.filter(message => message.severity === severity).length

const makeReport = (root: string, files: FileFixture[]): LintResult[] =>
  files.map(file => ({
    filePath: `${root}/${file.relativePath}`,
    messages: file.messages,
    errorCount: countSeverity(file.messages, 2),
    warningCount: countSeverity(file.messages, 1),
    suppressedMessages: []
  }))

const withMessages = (relativePath: string, messages: LintMessage[]): FileFixture[] =>
  BASELINE_FILES.map(file => (file.relativePath === relativePath ? {relativePath, messages} : file))

const withoutFile = (relativePath: string): FileFixture[] =>
  BASELINE_FILES.filter(file => file.relativePath !== relativePath)

const positionOf = (relativePath: string, message: LintMessage): string =>
  `${relativePath}:${message.line}:${message.column}`

// Returns a plain record rather than a `LintMessage` or `LintResult`: every caller uses it to build a fixture
// that is deliberately missing a field the gate requires, so the result is JSON to be written, not a report
// entry to be read.
const withoutFields = (record: object, fields: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !fields.includes(field)))

// Dropping `line` and `column` leaves a message the gate accepts — they are optional — so this one keeps the
// message type instead of degrading to a record
const withoutPosition = ({ruleId, severity, message}: LintMessage): LintMessage => ({ruleId, severity, message})

const formatFinding = (relativePath: string, message: LintMessage): string =>
  [positionOf(relativePath, message), message.ruleId, message.message].join('  ')

const totalsOf = (results: LintResult[]): ReportTotals => {
  const totals = {lintedFiles: results.length, filesWithFindings: 0, findings: 0, errors: 0, warnings: 0}

  for (const result of results) {
    const messages = result.messages

    if (messages.length > 0) {
      totals.filesWithFindings += 1
    }

    totals.findings += messages.length
    totals.errors += countSeverity(messages, 2)
    totals.warnings += countSeverity(messages, 1)
  }

  return totals
}

// Widened past LintResult[] because the projection tests hash a raw capture's projected form, which carries
// whatever fields ESLint wrote. The digest is over serialised JSON either way.
const digestOf = (results: object[]): string => createHash('sha256').update(JSON.stringify(results)).digest('hex')

// The four fields the projection elides, applied as the script applies them: on the result, and inside both of a
// result's message arrays. A capture and its projection hash alike, which is what lets one digest describe both.
const projectedOf = (results: Record<string, unknown>[]): Record<string, unknown>[] =>
  results.map(result => {
    const projected = withoutFields(result, DROPPED_RESULT_FIELDS)

    for (const field of MESSAGE_LIST_FIELDS) {
      const messages = projected[field]

      if (Array.isArray(messages)) {
        projected[field] = messages.map(message => withoutFields(message as object, DROPPED_MESSAGE_FIELDS))
      }
    }

    return projected
  })

const writeFixture = (name: string, contents: string): string => {
  const filePath = path.join(fixtureDir, name)

  writeFileSync(filePath, contents, 'utf8')

  return filePath
}

const writeReport = (name: string, root: string, files: FileFixture[]): string =>
  writeFixture(name, JSON.stringify(makeReport(root, files)))

const provenancePathOf = (baselinePath: string): string =>
  `${baselinePath.slice(0, -'.json'.length)}${PROVENANCE_SUFFIX}`

// The record the comparator demands beside a baseline, stated from the baseline itself so a fixture cannot drift
// out of agreement with its own record by accident. `overrides` is how a test states the one field it is breaking.
const makeRecord = (results: LintResult[], overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  digest: {algorithm: DIGEST_ALGORITHM, value: digestOf(results)},
  totals: totalsOf(results),
  changedFileCoverage: {baseCommit: BASE_COMMIT},
  ...overrides
})

const writeRecordBeside = (baselinePath: string, record: unknown): string => {
  const recordPath = provenancePathOf(baselinePath)

  writeFileSync(recordPath, JSON.stringify(record), 'utf8')

  return recordPath
}

// A baseline the comparator will accept: the report plus the record that describes it. Every test that expects to
// get past the refusal writes its baseline through this, and the refusal tests write the record themselves.
const writeBaseline = (
  name: string,
  root: string,
  files: FileFixture[],
  overrides: Record<string, unknown> = {}
): string => {
  const results = makeReport(root, files)
  const baselinePath = writeFixture(name, JSON.stringify(results))

  writeRecordBeside(baselinePath, makeRecord(results, overrides))

  return baselinePath
}

const makeIsolatedDir = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lint-baseline-isolated-'))

  isolatedDirs.push(directory)

  return directory
}

const writeStyleFixture = (name: string, lines: string[]): string => writeFixture(name, `${lines.join('\n')}\n`)

const runComparator = (...args: string[]): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [SCRIPT_PATH, ...args], {encoding: 'utf8'})

// Fixture reports name four files of this repository, so the changed-file derivation — which reads git in the
// checkout the script lives in, not in the fixture directory — would demand this feature's own changed files of
// every fixture after report. These runs therefore state an empty changed-file list; the derivation itself is
// covered by the tests that exercise it directly.
const runGate = (...args: string[]): SpawnSyncReturns<string> => runComparator('--require', emptyChangedList, ...args)

const runTokenScan = (...args: string[]): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [TOKEN_SCAN_PATH, ...args], {encoding: 'utf8'})

const scanStyleValue = (name: string, declaration: string): SpawnSyncReturns<string> =>
  runTokenScan(writeStyleFixture(name, ['export default {', '  block: {', `    ${declaration}`, '  }', '}']))

const runComparatorIn = (cwd: string, ...args: string[]): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [SCRIPT_PATH, ...args], {cwd, encoding: 'utf8'})

beforeAll(() => {
  fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-baseline-compare-'))
  emptyChangedList = writeFixture('no-changed-files.txt', '')
})

afterAll(() => {
  rmSync(fixtureDir, {recursive: true, force: true})

  for (const directory of isolatedDirs) {
    rmSync(directory, {recursive: true, force: true})
  }
})

describe('the comparator script', () => {
  it('sits at the path this suite spawns', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true)
  })
})

describe('reports captured under different absolute roots', () => {
  it('exits 0 when both reports hold the same findings', () => {
    const baseline = writeBaseline('same-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('same-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).not.toContain(BABEL_CONFIG)
    expect(stdout).not.toContain(STYLE_FILE)
  })

  it('exits 1 and prints an added finding against its repo-relative path', () => {
    const files = withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR])
    const baseline = writeBaseline('added-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('added-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(stdout).not.toContain(CI_ROOT)
    expect(stdout).not.toContain(LAPTOP_ROOT)
  })
})

describe('findings matched against the baseline', () => {
  it('exits 0 when the after report no longer holds a baseline finding', () => {
    const baseline = writeBaseline('removed-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('removed-after.json', LAPTOP_ROOT, withMessages(BABEL_CONFIG, []))
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stdout).not.toContain(BABEL_CONFIG)
  })

  it('exits 1 when a finding occurs more often than the baseline recorded it', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, SCRIPT_ERROR])
    const baseline = writeBaseline('duplicate-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('duplicate-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(SCRIPT_FILE, SCRIPT_ERROR))
  })

  it('exits 1 and labels an added fatal message that carries no rule id', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, ADDED_SCRIPT_FATAL])
    const baseline = writeBaseline('fatal-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('fatal-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(positionOf(SCRIPT_FILE, ADDED_SCRIPT_FATAL))
    expect(stdout).toContain(ADDED_SCRIPT_FATAL.message)
    expect(stdout).toContain('(fatal)')
    expect(stdout).not.toContain('null')
  })

  // A baseline path that still exists on disk and is missing from the after report means the after report linted
  // less than the baseline did, so the comparison cannot say the path is clean. It used to be counted on stderr
  // and passed; it fails, and the path is named, because "fewer files linted" is how a report hides a finding.
  it('exits 1 and names a baseline path the after report does not cover', () => {
    const baseline = writeBaseline('uncovered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('uncovered-after.json', LAPTOP_ROOT, withoutFile(BABEL_CONFIG))
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(`1 ${COVERAGE_FAILURE_NOTE}`)
    expect(stdout).toContain(`${BABEL_CONFIG}  ${LOST_BASELINE_REASON}`)
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 1 on a valid empty after report, because a run that linted nothing evidences nothing', () => {
    const baseline = writeBaseline('empty-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('empty-after.json', '[]')
    const {status, stdout, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain(EMPTY_AFTER_NOTE)
    expect(stdout).toContain(`${COVERAGE_FAILED} — ${EMPTY_AFTER_NOTE}`)
    expect(stdout).not.toContain(PASS_SUMMARY)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 0 and notes on stderr that a baseline holding no finding counts everything as new', () => {
    const baseline = writeBaseline('no-findings-baseline.json', CI_ROOT, CLEAN_FILES)
    const after = writeReport('no-findings-after.json', LAPTOP_ROOT, CLEAN_FILES)
    const {status, stdout, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain(EMPTY_BASELINE_NOTE)
    expect(stdout).toContain(PASS_SUMMARY)
  })
})

// The gate's inputs are the two reports and the record beside the baseline, and nothing else in the directory it
// is pointed at. Both tests below assert the directory's contents afterwards, which is what proves the comparison
// neither writes a companion file of its own nor leaves anything behind.
describe("the gate's inputs, alone in a directory of their own", () => {
  const ISOLATED_CONTENTS = ['after.json', 'baseline.json', `baseline${PROVENANCE_SUFFIX}`]

  const writeIsolatedInputs = (directory: string, afterFiles: FileFixture[]): void => {
    const baseline = makeReport(CI_ROOT, BASELINE_FILES)

    writeFileSync(path.join(directory, 'baseline.json'), JSON.stringify(baseline), 'utf8')
    writeFileSync(path.join(directory, `baseline${PROVENANCE_SUFFIX}`), JSON.stringify(makeRecord(baseline)), 'utf8')
    writeFileSync(path.join(directory, 'after.json'), JSON.stringify(makeReport(LAPTOP_ROOT, afterFiles)), 'utf8')
  }

  it('exits 0 on identical reports and their record, written alone outside any repository', () => {
    const directory = makeIsolatedDir()

    writeIsolatedInputs(directory, BASELINE_FILES)

    const notARepository = spawnSync('git', ['-C', directory, 'rev-parse', '--show-toplevel'], {encoding: 'utf8'})
    const {status, stdout, stderr} = runComparatorIn(
      directory,
      '--require',
      emptyChangedList,
      'baseline.json',
      'after.json'
    )

    expect(notARepository.status).not.toBe(0)
    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stderr).toBe('')
    expect(readdirSync(directory).sort()).toEqual(ISOLATED_CONTENTS)
  })

  it('exits 1 there on an added finding, naming it, and still writes nothing', () => {
    const directory = makeIsolatedDir()

    writeIsolatedInputs(directory, withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR]))

    const {status, stdout} = runComparatorIn(directory, '--require', emptyChangedList, 'baseline.json', 'after.json')

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(readdirSync(directory).sort()).toEqual(ISOLATED_CONTENTS)
  })
})

describe('usage and input errors', () => {
  it('exits 2 and prints usage when no report paths are given', () => {
    const {status, stderr, stdout} = runComparator()

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(USAGE_LINE)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and prints usage when only one report path is given', () => {
    const baseline = writeReport('single-argument.json', CI_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(USAGE_LINE)
  })

  it('exits 2 and prints usage for an unknown option, writing no companion file', () => {
    const baseline = writeReport('unknown-option-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('unknown-option-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator('--strict', baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('unknown option --strict')
    expect(stderr).toContain(USAGE_LINE)
    expect(existsSync(baseline.replace('.json', '.provenance.json'))).toBe(false)
  })

  it('prints both invocations it accepts, so neither documented option is left to be guessed at', () => {
    const {stderr} = runComparator()

    expect(stderr).toContain(USAGE_LINE)
    expect(stderr).toContain(PROJECT_USAGE_LINE)
  })

  it('exits 2 when --require is given no list to read', () => {
    const {status, stderr} = runComparator('--require')

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('--require needs the path of a file listing one changed file per line')
    expect(stderr).toContain(USAGE_LINE)
  })

  it('exits 2 and names the --require list when it cannot be read', () => {
    const baseline = writeBaseline('require-absent-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-absent-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const listPath = path.join(fixtureDir, 'never-written.txt')
    const {status, stderr, stdout} = runComparator('--require', listPath, baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`cannot read the --require list at ${listPath}`)
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 2 when --require is passed to the projection, which compares nothing', () => {
    const capture = writeReport('project-with-require.json', CI_ROOT, BASELINE_FILES)
    const outputPath = path.join(fixtureDir, 'project-with-require-out.json')
    const {status, stderr} = runComparator('--project', '--require', emptyChangedList, capture, outputPath)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('--require belongs to the comparison, not to --project')
    expect(existsSync(outputPath)).toBe(false)
  })

  it('exits 2 when --project is given a capture but no destination', () => {
    const capture = writeReport('project-one-path.json', CI_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator('--project', capture)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('--project takes the raw capture to project and the path to write the projection to')
    expect(stderr).toContain(PROJECT_USAGE_LINE)
  })

  it('exits 2 and names the baseline report when it is not valid JSON', () => {
    const baseline = writeFixture('malformed-baseline.json', '{oops')
    const after = writeReport('malformed-baseline-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(baseline)
    expect(stderr).toContain('is not valid JSON')
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the after report when it is not valid JSON', () => {
    const baseline = writeReport('malformed-after-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('malformed-after.json', '[{"filePath":')
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(after)
    expect(stderr).toContain('is not valid JSON')
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names a report path that does not exist', () => {
    const baseline = path.join(fixtureDir, 'absent-baseline.json')
    const after = writeReport('absent-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(baseline)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })
})

describe('valid JSON in a shape that is not an ESLint report', () => {
  it('exits 2 and names the baseline report when it holds an object instead of a top-level array', () => {
    const baseline = writeFixture('shape-object-baseline.json', '{}')
    const after = writeReport('shape-object-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${BASELINE_LABEL} ${baseline}`)
    expect(stderr).toContain('expected a top-level array, found object')
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the after report when it holds null instead of a top-level array', () => {
    const baseline = writeReport('shape-null-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('shape-null-after.json', 'null')
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${AFTER_LABEL} ${after}`)
    expect(stderr).toContain('expected a top-level array, found null')
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the baseline report when a result entry is not an object', () => {
    const baseline = writeFixture('shape-entry-baseline.json', JSON.stringify([42]))
    const after = writeReport('shape-entry-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${BASELINE_LABEL} ${baseline}`)
    expect(stderr).toContain('holds a non-object result at index 0')
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the after report when a result entry carries an empty filePath', () => {
    const baseline = writeReport('shape-file-path-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('shape-file-path-after.json', JSON.stringify([{filePath: ''}]))
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${AFTER_LABEL} ${after}`)
    expect(stderr).toContain('holds a result at index 0 without a non-empty string "filePath"')
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the baseline report when a result carries a non-array messages field', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: {}}]
    const baseline = writeFixture('shape-messages-baseline.json', JSON.stringify(entries))
    const after = writeReport('shape-messages-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${BASELINE_LABEL} ${baseline}`)
    expect(stderr).toContain(`holds a non-array "messages" for ${SHAPE_FILE_PATH}`)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the after report when a message entry is not an object', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [null]}]
    const baseline = writeReport('shape-message-entry-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('shape-message-entry-after.json', JSON.stringify(entries))
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${AFTER_LABEL} ${after}`)
    expect(stderr).toContain(`holds a non-object message for ${SHAPE_FILE_PATH}`)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the baseline report when a message carries no string message field', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [{ruleId: 'prettier/prettier', line: 12, column: 5}]}]
    const baseline = writeFixture('shape-message-text-baseline.json', JSON.stringify(entries))
    const after = writeReport('shape-message-text-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${BASELINE_LABEL} ${baseline}`)
    expect(stderr).toContain(`holds a message without a string "message" for ${SHAPE_FILE_PATH}`)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })
})

describe('result and message fields the gate refuses to assume', () => {
  it('exits 2 and names the path when a baseline result carries no messages field', () => {
    const baseline = writeFixture('no-messages-baseline.json', JSON.stringify([{filePath: SHAPE_FILE_PATH}]))
    const after = writeReport('no-messages-baseline-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${BASELINE_LABEL} ${baseline}`)
    expect(stderr).toContain(`holds a result without a "messages" array for ${SHAPE_FILE_PATH}`)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
    expect(stdout + stderr).not.toMatch(STACK_FRAME)
  })

  it('exits 2 and names the path when an after result carries no messages field', () => {
    const baseline = writeReport('no-messages-after-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('no-messages-after.json', JSON.stringify([{filePath: SHAPE_FILE_PATH}]))
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${AFTER_LABEL} ${after}`)
    expect(stderr).toContain(`holds a result without a "messages" array for ${SHAPE_FILE_PATH}`)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  // The reproduction behind the finding: an after report that keeps all 487 tracked paths and omits every message
  // array tallied zero findings and passed as "0 new findings".
  it('exits 2 on an after report holding every tracked baseline path with no messages array at all', () => {
    const tracked: LintResult[] = JSON.parse(readFileSync(TRACKED_BASELINE, 'utf8'))
    const stripped = tracked.map(result => withoutFields(result, ['messages']))
    const after = writeFixture('tracked-stripped-after.json', JSON.stringify(stripped))
    const {status, stderr, stdout} = runComparator(TRACKED_BASELINE, after)

    expect(stripped.length).toBe(487)
    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('holds a result without a "messages" array for')
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 2 when a message carries a numeric ruleId', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [{...ADDED_STYLE_ERROR, ruleId: 7}]}]
    const baseline = writeReport('rule-id-number-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('rule-id-number-after.json', JSON.stringify(entries))
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`holds a message whose "ruleId" is neither a string nor null for ${SHAPE_FILE_PATH}`)
    expect(stdout).not.toContain('(fatal)')
  })

  it('exits 2 when a message carries no ruleId at all', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [withoutFields(ADDED_STYLE_ERROR, ['ruleId'])]}]
    const baseline = writeReport('rule-id-absent-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('rule-id-absent-after.json', JSON.stringify(entries))
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`holds a message without a "ruleId" for ${SHAPE_FILE_PATH}`)
    expect(stdout).not.toContain('(fatal)')
  })

  it('exits 2 when a message carries a line that is not a number', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [{...ADDED_STYLE_ERROR, line: '12'}]}]
    const baseline = writeReport('line-string-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('line-string-after.json', JSON.stringify(entries))
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`holds a message whose "line" is not a non-negative number for ${SHAPE_FILE_PATH}`)
  })

  it('exits 2 when a message carries a severity that is not a number', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [{...ADDED_STYLE_ERROR, severity: 'error'}]}]
    const baseline = writeReport('severity-string-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('severity-string-after.json', JSON.stringify(entries))
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`holds a message whose "severity" is not a number for ${SHAPE_FILE_PATH}`)
  })

  it('exits 2 when a result carries a non-array suppressedMessages field', () => {
    const entries = [{filePath: SHAPE_FILE_PATH, messages: [], suppressedMessages: {}}]
    const baseline = writeFixture('suppressed-shape-baseline.json', JSON.stringify(entries))
    const after = writeReport('suppressed-shape-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`holds a non-array "suppressedMessages" for ${SHAPE_FILE_PATH}`)
  })

  it('accepts a fatal message stating ruleId null, and a message without line or column', () => {
    const positionless = withoutPosition(STYLE_FATAL)
    const files = withMessages(STYLE_FILE, [STYLE_FATAL, positionless])
    const baseline = writeBaseline('rule-id-null-baseline.json', CI_ROOT, files)
    const after = writeReport('rule-id-null-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
  })
})

describe('the tracked baseline artifact', () => {
  const artifact = (): LintResult[] => JSON.parse(readFileSync(TRACKED_BASELINE, 'utf8'))

  // The tracked artifact was captured under another root, so an after report built from it is re-rooted first —
  // which is also what proves the comparison survives two unrelated checkout roots at full size.
  const rerootedArtifact = (): LintResult[] => {
    const results = artifact()
    const capturedRoot = results[0].filePath.slice(0, results[0].filePath.indexOf(`/${ESLINTRC}`))

    return results.map(result => ({...result, filePath: result.filePath.replace(capturedRoot, LAPTOP_ROOT)}))
  }

  it('records the pre-feature state the AAP pins: 487 linted files and 49 findings in 31 files', () => {
    expect(totalsOf(artifact())).toEqual({
      lintedFiles: 487,
      filesWithFindings: 31,
      findings: 49,
      errors: 34,
      warnings: 15
    })
  })

  it('carries no field that would embed a linted file, and so no host from one', () => {
    const results = artifact()
    const messages = results.flatMap(result => [...result.messages, ...(result.suppressedMessages ?? [])])

    for (const field of DROPPED_RESULT_FIELDS) {
      expect(results.some(result => Object.hasOwn(result, field))).toBe(false)
    }

    for (const field of DROPPED_MESSAGE_FIELDS) {
      expect(messages.some(message => Object.hasOwn(message, field))).toBe(false)
    }

    // A deliberately partial fragment: asserting the artifact is free of the production API host without writing
    // that host into a tracked file. The elision above is what keeps it out.
    expect(readFileSync(TRACKED_BASELINE, 'utf8')).not.toContain('stateofhealth')
  })

  // The record beside the baseline is an input the comparison refuses to run without, so it has to exist and it
  // has to agree with the artifact — the two assertions the comparator itself makes, made here against the
  // tracked pair so a hand-edit to either file fails this suite as well as the gate.
  it('is described by the capture record tracked beside it', () => {
    const record = JSON.parse(readFileSync(TRACKED_PROVENANCE, 'utf8'))

    expect(existsSync(TRACKED_PROVENANCE)).toBe(true)
    expect(record.totals).toEqual(totalsOf(artifact()))
    expect(record.digest.algorithm).toBe(DIGEST_ALGORITHM)
    expect(record.digest.value).toBe(digestOf(artifact()))
    expect(record.changedFileCoverage.baseCommit).toBe(BASE_COMMIT)
  })

  it('exits 0 against a re-rooted copy of itself and reports its 49 findings on both sides', () => {
    const afterPath = writeFixture('tracked-reroot-after.json', JSON.stringify(rerootedArtifact()))
    const {status, stdout, stderr} = runGate(TRACKED_BASELINE, afterPath)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain('0 new findings (49 in the after report, 49 in the baseline)')
    expect(stdout).toContain("after report's 487 result(s)")
    expect(stderr).toBe('')
  })

  // The tracked pair driven exactly as the AAP's step-2 gate drives it — two arguments, the derivation left to
  // the comparator — against an after report that holds every changed lintable file this branch has.
  it('exits 0 on the two-argument invocation the project gate uses, deriving its own changed-file list', () => {
    const results = rerootedArtifact()
    const covered = new Set(results.map(result => result.filePath.slice(`${LAPTOP_ROOT}/`.length)))
    const extensions = new Set([...covered].map(relativePath => path.extname(relativePath)))
    const changed = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', BASE_COMMIT], {encoding: 'utf8'})
    const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {encoding: 'utf8'})
    const demanded = [...changed.stdout.split('\n'), ...untracked.stdout.split('\n')]
      .map(line => line.trim())
      .filter(line => line !== '' && extensions.has(path.extname(line)) && existsSync(line) && !covered.has(line))
    const afterPath = writeFixture(
      'tracked-derived-after.json',
      JSON.stringify([
        ...results,
        ...demanded.map(relativePath => ({filePath: `${LAPTOP_ROOT}/${relativePath}`, messages: []}))
      ])
    )
    const {status, stdout, stderr} = runComparator(TRACKED_BASELINE, afterPath)

    expect(changed.status).toBe(0)
    expect(demanded.length).toBeGreaterThan(0)
    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stderr).toBe('')
  })

  // The same invocation against an after report that covers only the baseline: every changed file is missing, so
  // the gate fails rather than reporting 0 new findings over a scope that never included them.
  it('exits 1 on that invocation when the after report covers none of the changed files', () => {
    const afterPath = writeFixture('tracked-underived-after.json', JSON.stringify(rerootedArtifact()))
    const {status, stdout} = runComparator(TRACKED_BASELINE, afterPath)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(COVERAGE_FAILURE_NOTE)
    expect(stdout).toContain(`(changed since ${BASE_COMMIT})`)
    expect(stdout).not.toContain(PASS_SUMMARY)
  })
})

// The gate's value rests on the baseline being the reviewed artifact. A baseline anyone may rewrite is a gate
// anyone may switch off, silently, by writing the finding they introduced into it — so the record beside the
// baseline is verified before a comparison happens, and a baseline it does not describe is refused.
describe('the capture record beside the baseline', () => {
  const writeRecord = (name: string, record: unknown, files: FileFixture[] = BASELINE_FILES): string => {
    const baseline = writeReport(name, CI_ROOT, files)

    writeRecordBeside(baseline, record)

    return baseline
  }

  it('exits 2 when no record sits beside the baseline, naming the path it looked for', () => {
    const baseline = writeReport('no-record-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('no-record-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${RECORD_LABEL} ${provenancePathOf(baseline)}`)
    expect(stderr).toContain(RECORD_REFUSAL_HINT)
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 2 when the record is not valid JSON', () => {
    const baseline = writeRecord('record-malformed-baseline.json', {})
    const after = writeReport('record-malformed-after.json', LAPTOP_ROOT, BASELINE_FILES)

    writeFileSync(provenancePathOf(baseline), '{"digest":', 'utf8')

    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('is not valid JSON')
  })

  it('exits 2 when the record is an array rather than an object', () => {
    const baseline = writeRecord('record-array-baseline.json', [])
    const after = writeReport('record-array-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('is not a capture record')
  })

  it('exits 2 when the record names a digest algorithm other than sha256', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const baseline = writeRecord(
      'record-algorithm-baseline.json',
      makeRecord(results, {digest: {algorithm: 'md5', value: digestOf(results)}})
    )
    const after = writeReport('record-algorithm-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('states digest.algorithm "md5" rather than "sha256"')
  })

  it('exits 2 when digest.value is not a sha256 digest at all', () => {
    const baseline = writeRecord(
      'record-digest-shape-baseline.json',
      makeRecord(makeReport(CI_ROOT, BASELINE_FILES), {digest: {algorithm: DIGEST_ALGORITHM, value: 'not-a-digest'}})
    )
    const after = writeReport('record-digest-shape-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('holds no sha256 digest.value')
  })

  it('exits 2 when the record states no commit to derive changed files from', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const record = makeRecord(results)

    delete record.changedFileCoverage

    const baseline = writeRecord('record-no-commit-baseline.json', record)
    const after = writeReport('record-no-commit-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('holds no "changedFileCoverage" object')
  })

  it('exits 2 naming the recorded field when a total disagrees with the baseline', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const totals = {...totalsOf(results), findings: totalsOf(results).findings + 1}
    const baseline = writeRecord('record-totals-baseline.json', makeRecord(results, {totals}))
    const after = writeReport('record-totals-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`totals.findings ${totals.findings} rather than ${totalsOf(results).findings}`)
  })

  it('exits 2 when a recorded rule count disagrees with the baseline', () => {
    const baseline = writeRecord(
      'record-composition-baseline.json',
      makeRecord(makeReport(CI_ROOT, BASELINE_FILES), {composition: {findingsByRule: {'no-such-rule': 3}}})
    )
    const after = writeReport('record-composition-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runGate(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('composition.findingsByRule["no-such-rule"] 3 rather than 0')
  })

  // The reproduction the finding describes, both halves of it: the honest baseline reports the new finding, and
  // the baseline hand-edited to claim that finding is already known is refused instead of believed.
  describe('a baseline edited to claim a new finding was always there', () => {
    const afterFiles = withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR])

    it('exits 1 against the reviewed baseline, reporting the finding', () => {
      const baseline = writeBaseline('masking-honest-baseline.json', CI_ROOT, BASELINE_FILES)
      const after = writeReport('masking-after.json', LAPTOP_ROOT, afterFiles)
      const {status, stdout} = runGate(baseline, after)

      expect(status).toBe(EXIT_GATE_FAILED)
      expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    })

    it('exits 2 against the edited one, naming the recorded digest and the measured one', () => {
      const reviewed = makeReport(CI_ROOT, BASELINE_FILES)
      const edited = makeReport(CI_ROOT, afterFiles)
      const baseline = writeRecord('masking-edited-baseline.json', makeRecord(reviewed), afterFiles)
      const after = writeReport('masking-edited-after.json', LAPTOP_ROOT, afterFiles)
      const {status, stderr, stdout} = runGate(baseline, after)

      expect(status).toBe(EXIT_INPUT_ERROR)
      expect(stderr).toContain(digestOf(reviewed))
      expect(stderr).toContain(digestOf(edited))
      expect(stdout).not.toContain(PASS_SUMMARY)
      expect(stdout).not.toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    })
  })
})

// A file this change added is in no baseline, so a report that simply never linted it would pass a baseline-only
// comparison. The gate therefore derives what must be covered and fails when it is not — and fails, rather than
// waving the check through, when it cannot derive it.
describe('changed-file coverage', () => {
  const REQUIRED_REASON = (listPath: string): string => `(required by ${listPath})`
  const UNCOVERED_REPO_FILE = 'src/constants/strings.ts'

  const writeList = (name: string, lines: string[]): string => writeFixture(name, `${lines.join('\n')}\n`)

  it('exits 2 when the recorded commit cannot be resolved, rather than skipping the derivation', () => {
    const baseline = writeBaseline('unresolvable-baseline.json', CI_ROOT, BASELINE_FILES, {
      changedFileCoverage: {baseCommit: UNRESOLVABLE_COMMIT}
    })
    const after = writeReport('unresolvable-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`cannot resolve the capture record's baseCommit ${UNRESOLVABLE_COMMIT}`)
    expect(stderr).toContain('is an error, not a skipped check')
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 1 and names a required file the after report does not cover', () => {
    const listPath = writeList('required-uncovered.txt', [UNCOVERED_REPO_FILE])
    const baseline = writeBaseline('required-uncovered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('required-uncovered-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator('--require', listPath, baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(`${UNCOVERED_REPO_FILE}  ${REQUIRED_REASON(listPath)}`)
    expect(stdout).not.toContain(PASS_SUMMARY)
  })

  it('exits 0 when the required list names only files the after report covers', () => {
    const listPath = writeList('required-covered.txt', [BABEL_CONFIG, STYLE_FILE])
    const baseline = writeBaseline('required-covered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('required-covered-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator('--require', listPath, baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
  })

  it('accepts the list as one --require=<path> argument', () => {
    const listPath = writeList('required-inline.txt', [BABEL_CONFIG])
    const baseline = writeBaseline('required-inline-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('required-inline-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator(`--require=${listPath}`, baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
  })

  // An empty list replaces the derivation and nothing else: the baseline's own paths are still demanded, which is
  // why every fixture run in this suite can pass an empty list without weakening what it asserts.
  it('demands the baseline paths even from an empty required list', () => {
    const baseline = writeBaseline('empty-list-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('empty-list-after.json', LAPTOP_ROOT, withoutFile(STYLE_FILE))
    const {status, stdout} = runComparator('--require', emptyChangedList, baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(`${STYLE_FILE}  ${LOST_BASELINE_REASON}`)
  })

  it('demands nothing of a required path whose extension the baseline never covered, or that is gone', () => {
    const listPath = writeList('required-filtered.txt', [
      'scripts/lint-baseline-compare.mjs',
      'src/screens/DeletedScreen/index.ts'
    ])
    const baseline = writeBaseline('required-filtered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('required-filtered-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator('--require', listPath, baseline, after)

    expect(existsSync('scripts/lint-baseline-compare.mjs')).toBe(true)
    expect(existsSync('src/screens/DeletedScreen/index.ts')).toBe(false)
    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
  })

  // coverage/ is ignored by .eslintrc.js but not by .gitignore, so an untracked report written there is exactly
  // the case that would otherwise be demanded of an after report no "eslint ." run could ever have covered.
  it('demands nothing of a required path ESLint ignores, even though it exists and git would list it', () => {
    const ignoredPath = 'coverage/blitzy_adhoc_test_ignored.ts'
    const listPath = writeList('required-ignored.txt', [ignoredPath])
    const baseline = writeBaseline('required-ignored-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('required-ignored-after.json', LAPTOP_ROOT, BASELINE_FILES)

    mkdirSync(path.dirname(ignoredPath), {recursive: true})
    writeFileSync(ignoredPath, 'export const ignored: unknown = 1\n', 'utf8')

    try {
      const {status, stdout} = runComparator('--require', listPath, baseline, after)

      expect(existsSync(ignoredPath)).toBe(true)
      expect(status).toBe(EXIT_OK)
      expect(stdout).toContain(PASS_SUMMARY)
    } finally {
      rmSync(path.dirname(ignoredPath), {recursive: true, force: true})
    }
  })
})

// ESLint's raw report embeds the linted file's own text, so the tracked artifact is a projection of a capture
// rather than the capture itself. That projection is the comparator's job too, because the digest the record
// carries has to be the one the comparator will recompute.
describe('projection mode', () => {
  const RAW_CAPTURE: Record<string, unknown>[] = [
    {
      filePath: `${CI_ROOT}/${STYLE_FILE}`,
      messages: [
        {
          ...ADDED_STYLE_ERROR,
          fix: {range: [12, 19], text: 'Theme.colors.white'},
          suggestions: [{desc: 'Use a token', fix: {range: [12, 19], text: 'Theme.colors.white'}}]
        }
      ],
      suppressedMessages: [{...CONFIG_WARNING, fix: {range: [0, 1], text: ''}}],
      errorCount: 1,
      warningCount: 0,
      source: "const background = '#0C1310'\n",
      output: 'const background = Theme.colors.background\n'
    },
    {
      filePath: `${CI_ROOT}/${BABEL_CONFIG}`,
      messages: [CONFIG_ERROR],
      suppressedMessages: [],
      errorCount: 1,
      warningCount: 0
    }
  ]

  const writeCapture = (name: string): string => writeFixture(name, JSON.stringify(RAW_CAPTURE))

  const project = (name: string): {destination: string; result: SpawnSyncReturns<string>} => {
    const destination = path.join(fixtureDir, `${name}-projected.json`)

    return {destination, result: runComparator('--project', writeCapture(`${name}-capture.json`), destination)}
  }

  it('writes the capture without the four fields that embed a linted file', () => {
    const {destination, result} = project('elision')
    const projected: Record<string, unknown>[] = JSON.parse(readFileSync(destination, 'utf8'))
    const messages = projected.flatMap(entry =>
      MESSAGE_LIST_FIELDS.flatMap(field => (entry[field] as object[] | undefined) ?? [])
    )

    expect(result.status).toBe(EXIT_OK)
    expect(projected).toEqual(projectedOf(RAW_CAPTURE))

    for (const field of DROPPED_RESULT_FIELDS) {
      expect(projected.some(entry => Object.hasOwn(entry, field))).toBe(false)
    }

    for (const field of DROPPED_MESSAGE_FIELDS) {
      expect(messages.some(message => Object.hasOwn(message, field))).toBe(false)
    }

    expect(readFileSync(destination, 'utf8')).not.toContain('#0C1310')
  })

  it('reports what it elided, so the operator can see the projection was not a copy', () => {
    const {result} = project('counts')

    expect(result.stdout).toContain('projected 2 result(s)')
    expect(result.stdout).toContain('1 source')
    expect(result.stdout).toContain('1 output')
    expect(result.stdout).toContain('2 fix')
    expect(result.stdout).toContain('1 suggestions')
  })

  // The digest is taken over the projected capture, so a raw capture and its projection hash alike — which is
  // what lets one recorded digest describe the capture that was taken and the artifact that gets committed.
  it('prints the digest and totals the record needs, measured over the projected capture', () => {
    const {destination, result} = project('record-block')
    const printed = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))

    expect(printed.digest).toEqual({algorithm: DIGEST_ALGORITHM, value: digestOf(projectedOf(RAW_CAPTURE))})
    expect(printed.totals).toEqual({lintedFiles: 2, filesWithFindings: 2, findings: 2, errors: 2, warnings: 0})
    expect(printed.composition).toEqual({
      fatalFindings: 0,
      filesWithFindingsOutsideSrc: 1,
      findingsOutsideSrc: 1,
      findingsByRule: {'@typescript-eslint/no-var-requires': 1, 'prettier/prettier': 1}
    })
    expect(digestOf(JSON.parse(readFileSync(destination, 'utf8')))).toBe(printed.digest.value)
  })

  it('writes the compact single-line JSON that eslint -o writes, so the file it wrote is what hashes', () => {
    const {destination} = project('compact')
    const contents = readFileSync(destination, 'utf8')

    expect(contents).not.toContain('\n')
    expect(contents.startsWith('[{')).toBe(true)
  })

  it('produces a baseline the comparison accepts once the printed block is recorded beside it', () => {
    const {destination, result} = project('round-trip')
    const printed = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
    const after = writeFixture('round-trip-after.json', JSON.stringify(projectedOf(RAW_CAPTURE)))

    writeRecordBeside(destination, {...printed, changedFileCoverage: {baseCommit: BASE_COMMIT}})

    const gate = runGate(destination, after)

    expect(gate.status).toBe(EXIT_OK)
    expect(gate.stdout).toContain(PASS_SUMMARY)
    expect(gate.stderr).toBe('')
  })

  it('exits 2 on a capture that is not valid JSON, writing no destination file', () => {
    const capture = writeFixture('project-malformed-capture.json', '[{')
    const destination = path.join(fixtureDir, 'project-malformed-projected.json')
    const {status, stderr} = runComparator('--project', capture, destination)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('is not valid JSON')
    expect(existsSync(destination)).toBe(false)
  })

  it('exits 2 on a capture in the wrong shape, writing no destination file', () => {
    const capture = writeFixture('project-shape-capture.json', JSON.stringify({results: []}))
    const destination = path.join(fixtureDir, 'project-shape-projected.json')
    const {status, stderr} = runComparator('--project', capture, destination)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('expected a top-level array')
    expect(existsSync(destination)).toBe(false)
  })
})

describe('the token-literal scan on colour-valued positions', () => {
  it('exits 1 on a named colour written on a colour property, which no token can be', () => {
    const {status, stderr} = scanStyleValue('token-named-color.styled.ts', "color: 'red'")

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toMatch(/token-named-color\.styled\.ts:3:\d+ {2}color: 'red' {2}\(hardcoded color\)/)
    expect(stderr).toContain(REMEDY_LINE)
  })

  it('exits 1 on a named colour written on any *Color property', () => {
    const {status, stderr} = scanStyleValue('token-suffix-color.styled.ts', "backgroundColor: 'white'")

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain("backgroundColor: 'white'")
    expect(stderr).toContain(REASON_COLOR)
  })

  it('still flags a hex colour written on a property whose name does not name a colour', () => {
    const {status, stderr} = scanStyleValue('token-hex-elsewhere.styled.ts', "overlay: '#16BC85'")

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain(REASON_COLOR)
  })

  it('exits 1 on a named colour passed as a JSX colour attribute', () => {
    const fixture = writeStyleFixture('token-attr-color.tsx', [
      'export const Glyph = () => (',
      '  <Svg stroke="red" strokeWidth={Stroke.DEFAULT} />',
      ')'
    ])
    const {status, stderr} = runTokenScan(fixture)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toMatch(/token-attr-color\.tsx:2:\d+ {2}stroke="red" {2}\(hardcoded color\)/)
  })

  it('exits 0 on the keyword colours the exemption list names', () => {
    const fixture = writeStyleFixture('token-keyword-color.tsx', [
      'export const Glyph = () => (',
      '  <Svg fill="none" stroke="currentColor" color={Theme.colors.text} />',
      ')'
    ])
    const {status, stdout} = runTokenScan(fixture)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(CLEAN_SCAN_NOTE)
  })
})

describe('the token-literal scan on numeric design values', () => {
  it('exits 1 on a quoted decimal, which the integer-only pattern used to pass', () => {
    const fixture = writeStyleFixture('token-decimal-attr.tsx', [
      'export const Glyph = () => (',
      '  <Svg strokeWidth="1.5" stroke={Theme.colors.text} />',
      ')'
    ])
    const {status, stderr} = runTokenScan(fixture)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toMatch(/token-decimal-attr\.tsx:2:\d+ {2}strokeWidth="1\.5" {2}\(quoted numeric literal\)/)
  })

  it('exits 1 on a signed quoted decimal in a style value', () => {
    const {status, stderr} = scanStyleValue('token-signed-decimal.styled.ts', "letterSpacing: '-0.4'")

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain(REASON_NUMERIC_STRING)
  })

  it('exits 0 on a percentage string, which stays exempt', () => {
    const {status, stdout} = scanStyleValue('token-percentage.styled.ts', "width: '50%'")

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(CLEAN_SCAN_NOTE)
  })
})

describe('the token-literal scan on font weights', () => {
  for (const weight of ['0', '400', '600', '700']) {
    it(`exits 1 on the quoted weight '${weight}', which only a named FontWeight token may express`, () => {
      const {status, stderr} = scanStyleValue(`token-weight-${weight}.styled.ts`, `fontWeight: '${weight}'`)

      expect(status).toBe(EXIT_GATE_FAILED)
      expect(stderr).toContain(`fontWeight: '${weight}'`)
      expect(stderr).toContain(REASON_FONT_WEIGHT_STRING)
    })
  }

  it('exits 1 on a bare numeric weight, zero included, because the zero exemption does not reach fontWeight', () => {
    const {status, stderr} = scanStyleValue('token-weight-bare-zero.styled.ts', 'fontWeight: 0')

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain(REASON_NUMERIC)
  })

  it('exits 0 on the keyword weights, which are not numeric', () => {
    const {status, stdout} = scanStyleValue('token-weight-keyword.styled.ts', "fontWeight: 'bold'")

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(CLEAN_SCAN_NOTE)
  })
})

describe('the token-literal scan on a file that resolves every value to a token', () => {
  it('exits 0 over the whole exemption surface', () => {
    const fixture = writeStyleFixture('token-clean.styled.ts', [
      "import FontSize, {FontWeight, LetterSpacing} from '@styles/fontSize'",
      "import {Sizes, Stroke} from '@styles/sizes'",
      "import Spacing from '@styles/spacing'",
      "import {Theme} from '@styles/theme'",
      '',
      '// letterSpacing: 0.6',
      '/* borderWidth: 1.5 */',
      'export default {',
      '  row: {',
      '    flex: 1,',
      "    flexDirection: 'row',",
      '    margin: 0,',
      "    width: '50%',",
      "    height: 'auto',",
      "    position: 'absolute',",
      "    overflow: 'hidden',",
      "    backgroundColor: 'transparent',",
      '    borderColor: Theme.colors.hairline,',
      '    borderWidth: Stroke.THIN,',
      '    padding: Spacing.MEDIUM,',
      '    minHeight: Sizes.CONTROL',
      '  },',
      '  label: {',
      '    color: Theme.colors.text,',
      '    fontSize: FontSize.H2,',
      '    fontWeight: FontWeight.BOLD,',
      '    letterSpacing: LetterSpacing.TITLE,',
      "    textTransform: 'uppercase',",
      "    textDecorationLine: 'line-through'",
      '  }',
      '}'
    ])
    const {status, stdout, stderr} = runTokenScan(fixture)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(CLEAN_SCAN_NOTE)
    expect(stderr).toBe('')
  })

  // The literal this gate rejected at 35:69 before the two-sided gutter was written through named values.
  it('exits 0 on the tracked stylesheet the gate reported', () => {
    const {status, stdout} = runTokenScan(SCANNED_STYLE_FILE)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(CLEAN_SCAN_NOTE)
  })
})

describe('the token-literal scan argument contract', () => {
  it('exits 0 with a note when no file is passed, so a change touching no stylesheet passes', () => {
    const {status, stdout} = runTokenScan()

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(NOTHING_TO_SCAN_NOTE)
  })

  it('exits 2 and names a path it cannot read', () => {
    const {status, stderr} = runTokenScan(path.join(fixtureDir, 'token-absent.styled.ts'))

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('token-absent.styled.ts')
    expect(stderr).not.toMatch(STACK_FRAME)
  })

  it('stops at the first hit, reporting only the dirty file of the pair', () => {
    const clean = writeStyleFixture('token-pair-clean.styled.ts', [
      'export default {',
      '  block: {',
      '    padding: Spacing.MEDIUM',
      '  }',
      '}'
    ])
    const dirty = writeStyleFixture('token-pair-dirty.styled.ts', [
      'export default {',
      '  block: {',
      '    padding: 16',
      '  }',
      '}'
    ])
    const {status, stderr} = runTokenScan(clean, dirty)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stderr).toContain('token-pair-dirty.styled.ts')
    expect(stderr).not.toContain('token-pair-clean.styled.ts')
    expect(stderr).toContain(REASON_NUMERIC)
  })
})
