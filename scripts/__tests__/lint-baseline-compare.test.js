// Plain JS on purpose: Jest's default testMatch collects .js but matches .mjs with neither pattern, so a suite for
// the .mjs lint gate can only be picked up in this form. The break is confined to scripts/ tooling.
//
// Both scripts/ gates are covered here rather than in one suite each: the token scan's own specification gives it
// no suite file, so its classification rules are pinned in the one suite the plan tracks for this folder.
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import process from 'node:process'

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

const USAGE_LINE = 'Usage: node scripts/lint-baseline-compare.mjs <baseline.json> <after.json>'
const STACK_FRAME = /\n\s+at\s/
const BASELINE_LABEL = 'the baseline report at'
const AFTER_LABEL = 'the after report at'
const NEW_FINDINGS_NOTE = 'new lint finding(s)'
const PASS_SUMMARY = 'passed — 0 new findings'
const EMPTY_AFTER_NOTE = 'the after report holds no results at all'
const EMPTY_BASELINE_NOTE = 'the baseline report holds 0 findings'
const UNCOVERED_NOTE = 'path(s) the baseline covers do not appear in the after report'

const ESLINTRC = '.eslintrc.js'
const BABEL_CONFIG = 'babel.config.js'
const SCRIPT_FILE = 'scripts/transform-imports.js'
const STYLE_FILE = 'src/screens/Macros/index.styled.ts'
const SHAPE_FILE_PATH = `${CI_ROOT}/${STYLE_FILE}`

const DROPPED_RESULT_FIELDS = ['source', 'output']
const DROPPED_MESSAGE_FIELDS = ['fix', 'suggestions']

const CONFIG_ERROR = {
  ruleId: '@typescript-eslint/no-var-requires',
  severity: 2,
  message: 'Require statement not part of import statement.',
  line: 3,
  column: 14
}

const CONFIG_WARNING = {
  ruleId: 'padding-line-between-statements',
  severity: 1,
  message: 'Expected blank line before this statement.',
  line: 7,
  column: 3
}

const SCRIPT_ERROR = {
  ruleId: '@typescript-eslint/no-var-requires',
  severity: 2,
  message: 'Require statement not part of import statement.',
  line: 1,
  column: 12
}

const STYLE_FATAL = {ruleId: null, severity: 2, message: 'Parsing error: Unexpected token', line: 42, column: 3}

const ADDED_STYLE_ERROR = {
  ruleId: 'prettier/prettier',
  severity: 2,
  message: 'Delete trailing whitespace',
  line: 12,
  column: 5
}

const ADDED_SCRIPT_FATAL = {
  ruleId: null,
  severity: 2,
  message: 'Parsing error: Unexpected end of input',
  line: 88,
  column: 1
}

const BASELINE_FILES = [
  {relativePath: ESLINTRC, messages: [CONFIG_ERROR]},
  {relativePath: BABEL_CONFIG, messages: [CONFIG_WARNING]},
  {relativePath: SCRIPT_FILE, messages: [SCRIPT_ERROR]},
  {relativePath: STYLE_FILE, messages: [STYLE_FATAL]}
]

const CLEAN_FILES = BASELINE_FILES.map(file => ({relativePath: file.relativePath, messages: []}))

let fixtureDir = ''
const isolatedDirs = []

const countSeverity = (messages, severity) => messages.filter(message => message.severity === severity).length

const makeReport = (root, files) =>
  files.map(file => ({
    filePath: `${root}/${file.relativePath}`,
    messages: file.messages,
    errorCount: countSeverity(file.messages, 2),
    warningCount: countSeverity(file.messages, 1),
    suppressedMessages: []
  }))

const withMessages = (relativePath, messages) =>
  BASELINE_FILES.map(file => (file.relativePath === relativePath ? {relativePath, messages} : file))

const withoutFile = relativePath => BASELINE_FILES.filter(file => file.relativePath !== relativePath)

const positionOf = (relativePath, message) => `${relativePath}:${message.line}:${message.column}`

const withoutFields = (record, fields) =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !fields.includes(field)))

const formatFinding = (relativePath, message) =>
  [positionOf(relativePath, message), message.ruleId, message.message].join('  ')

const totalsOf = results => {
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

const digestOf = results => createHash('sha256').update(JSON.stringify(results)).digest('hex')

const writeFixture = (name, contents) => {
  const filePath = path.join(fixtureDir, name)

  writeFileSync(filePath, contents, 'utf8')

  return filePath
}

const writeReport = (name, root, files) => writeFixture(name, JSON.stringify(makeReport(root, files)))

const makeIsolatedDir = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lint-baseline-isolated-'))

  isolatedDirs.push(directory)

  return directory
}

const writeStyleFixture = (name, lines) => writeFixture(name, `${lines.join('\n')}\n`)

const runComparator = (...args) => spawnSync(process.execPath, [SCRIPT_PATH, ...args], {encoding: 'utf8'})

const runTokenScan = (...args) => spawnSync(process.execPath, [TOKEN_SCAN_PATH, ...args], {encoding: 'utf8'})

const scanStyleValue = (name, declaration) =>
  runTokenScan(writeStyleFixture(name, ['export default {', '  block: {', `    ${declaration}`, '  }', '}']))

const runComparatorIn = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT_PATH, ...args], {cwd, encoding: 'utf8'})

beforeAll(() => {
  fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-baseline-compare-'))
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
    const baseline = writeReport('same-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('same-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).not.toContain(BABEL_CONFIG)
    expect(stdout).not.toContain(STYLE_FILE)
  })

  it('exits 1 and prints an added finding against its repo-relative path', () => {
    const files = withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR])
    const baseline = writeReport('added-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('added-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(stdout).not.toContain(CI_ROOT)
    expect(stdout).not.toContain(LAPTOP_ROOT)
  })
})

describe('findings matched against the baseline', () => {
  it('exits 0 when the after report no longer holds a baseline finding', () => {
    const baseline = writeReport('removed-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('removed-after.json', LAPTOP_ROOT, withMessages(BABEL_CONFIG, []))
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stdout).not.toContain(BABEL_CONFIG)
  })

  it('exits 1 when a finding occurs more often than the baseline recorded it', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, SCRIPT_ERROR])
    const baseline = writeReport('duplicate-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('duplicate-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(SCRIPT_FILE, SCRIPT_ERROR))
  })

  it('exits 1 and labels an added fatal message that carries no rule id', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, ADDED_SCRIPT_FATAL])
    const baseline = writeReport('fatal-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('fatal-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(positionOf(SCRIPT_FILE, ADDED_SCRIPT_FATAL))
    expect(stdout).toContain(ADDED_SCRIPT_FATAL.message)
    expect(stdout).toContain('(fatal)')
    expect(stdout).not.toContain('null')
  })

  it('exits 0 and counts, without listing, the baseline paths the after report does not cover', () => {
    const baseline = writeReport('uncovered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('uncovered-after.json', LAPTOP_ROOT, withoutFile(BABEL_CONFIG))
    const {status, stdout, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain(`1 ${UNCOVERED_NOTE}`)
    expect(stderr).not.toContain(BABEL_CONFIG)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 0 on a valid empty after report and says on stderr that it linted nothing', () => {
    const baseline = writeReport('empty-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('empty-after.json', '[]')
    const {status, stdout, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain(EMPTY_AFTER_NOTE)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stdout).not.toContain(EMPTY_AFTER_NOTE)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 0 and notes on stderr that a baseline holding no finding counts everything as new', () => {
    const baseline = writeReport('no-findings-baseline.json', CI_ROOT, CLEAN_FILES)
    const after = writeReport('no-findings-after.json', LAPTOP_ROOT, CLEAN_FILES)
    const {status, stdout, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain(EMPTY_BASELINE_NOTE)
    expect(stdout).toContain(PASS_SUMMARY)
  })
})

describe("the two reports as the gate's only inputs", () => {
  const writeIsolatedPair = (directory, afterFiles) => {
    writeFileSync(path.join(directory, 'baseline.json'), JSON.stringify(makeReport(CI_ROOT, BASELINE_FILES)), 'utf8')
    writeFileSync(path.join(directory, 'after.json'), JSON.stringify(makeReport(LAPTOP_ROOT, afterFiles)), 'utf8')
  }

  it('exits 0 on identical reports written alone into a directory outside any repository', () => {
    const directory = makeIsolatedDir()

    writeIsolatedPair(directory, BASELINE_FILES)

    const notARepository = spawnSync('git', ['-C', directory, 'rev-parse', '--show-toplevel'], {encoding: 'utf8'})
    const {status, stdout, stderr} = runComparatorIn(directory, 'baseline.json', 'after.json')

    expect(notARepository.status).not.toBe(0)
    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
    expect(stderr).not.toContain('provenance')
    expect(readdirSync(directory).sort()).toEqual(['after.json', 'baseline.json'])
  })

  it('exits 1 there on an added finding, naming it, and still writes nothing', () => {
    const directory = makeIsolatedDir()

    writeIsolatedPair(directory, withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR]))

    const {status, stdout} = runComparatorIn(directory, 'baseline.json', 'after.json')

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(readdirSync(directory).sort()).toEqual(['after.json', 'baseline.json'])
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

  it('exits 2 for --project and writes no baseline of its own', () => {
    const baseline = writeReport('project-baseline.json', CI_ROOT, BASELINE_FILES)
    const outputPath = path.join(fixtureDir, 'project-output.json')
    const {status, stderr} = runComparator('--project', baseline, outputPath)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('unknown option --project')
    expect(stderr).toContain(USAGE_LINE)
    expect(existsSync(outputPath)).toBe(false)
  })

  it('exits 2 for --require and writes no companion file', () => {
    const baseline = writeReport('require-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator('--require', BABEL_CONFIG, baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('unknown option --require')
    expect(stderr).toContain(USAGE_LINE)
    expect(existsSync(baseline.replace('.json', '.provenance.json'))).toBe(false)
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
    const tracked = JSON.parse(readFileSync(TRACKED_BASELINE, 'utf8'))
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
    const positionless = withoutFields(STYLE_FATAL, ['line', 'column'])
    const files = withMessages(STYLE_FILE, [STYLE_FATAL, positionless])
    const baseline = writeReport('rule-id-null-baseline.json', CI_ROOT, files)
    const after = writeReport('rule-id-null-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain(PASS_SUMMARY)
  })
})

describe('the tracked baseline artifact', () => {
  const artifact = () => JSON.parse(readFileSync(TRACKED_BASELINE, 'utf8'))

  // The tracked artifact was captured under another root, so an after report built from it is re-rooted first —
  // which is also what proves the comparison survives two unrelated checkout roots at full size.
  const rerootedArtifact = () => {
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

  // The record beside the baseline is tracked capture evidence, not an input to this gate: the comparison reads the
  // two reports and nothing else, so the assertion runs only while the file is present.
  it('is described by the capture record tracked beside it, when that record is present', () => {
    if (!existsSync(TRACKED_PROVENANCE)) {
      return
    }

    const record = JSON.parse(readFileSync(TRACKED_PROVENANCE, 'utf8'))

    expect(record.totals).toEqual(totalsOf(artifact()))
    expect(record.digest.algorithm).toBe('sha256')
    expect(record.digest.value).toBe(digestOf(artifact()))
  })

  it('exits 0 against a re-rooted copy of itself and reports its 49 findings on both sides', () => {
    const afterPath = writeFixture('tracked-reroot-after.json', JSON.stringify(rerootedArtifact()))
    const {status, stdout, stderr} = runComparator(TRACKED_BASELINE, afterPath)

    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain('0 new findings (49 in the after report, 49 in the baseline)')
    expect(stdout).toContain("after report's 487 result(s)")
    expect(stderr).toBe('')
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
