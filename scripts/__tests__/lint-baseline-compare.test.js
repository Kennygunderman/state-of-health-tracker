// Plain JS on purpose: Jest's default testMatch collects .js but matches .mjs with neither pattern, so a suite for
// the .mjs lint gate can only be picked up in this form. The break is confined to scripts/ tooling.
import {spawnSync} from 'node:child_process'
import {existsSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import process from 'node:process'

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'lint-baseline-compare.mjs')

// The comparator exists to match findings across checkout roots, so the fixtures are captured under two
// deliberately unrelated absolute roots: a CI runner and a developer laptop.
const CI_ROOT = '/home/runner/work/app/mobile'
const LAPTOP_ROOT = '/Users/dev/projects/app/mobile'

const EXIT_OK = 0
const EXIT_NEW_FINDINGS = 1
const EXIT_INPUT_ERROR = 2

const USAGE_LINE = 'Usage: node scripts/lint-baseline-compare.mjs <baseline.json> <after.json>'
const STACK_FRAME = /\n\s+at\s/

const ESLINTRC = '.eslintrc.js'
const BABEL_CONFIG = 'babel.config.js'
const SCRIPT_FILE = 'scripts/transform-imports.js'
const STYLE_FILE = 'src/screens/Macros/index.styled.ts'

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

let fixtureDir = ''

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

const positionOf = (relativePath, message) => `${relativePath}:${message.line}:${message.column}`

const formatFinding = (relativePath, message) =>
  [positionOf(relativePath, message), message.ruleId, message.message].join('  ')

const writeFixture = (name, contents) => {
  const filePath = path.join(fixtureDir, name)

  writeFileSync(filePath, contents, 'utf8')

  return filePath
}

const writeReport = (name, root, files) => writeFixture(name, JSON.stringify(makeReport(root, files)))

const runComparator = (...args) => spawnSync(process.execPath, [SCRIPT_PATH, ...args], {encoding: 'utf8'})

beforeAll(() => {
  fixtureDir = mkdtempSync(path.join(tmpdir(), 'lint-baseline-compare-'))
})

afterAll(() => {
  rmSync(fixtureDir, {recursive: true, force: true})
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

    expect(status).toBe(EXIT_NEW_FINDINGS)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(stdout).not.toContain(CI_ROOT)
    expect(stdout).not.toContain(LAPTOP_ROOT)
  })
})

describe('baseline coverage', () => {
  it('exits 0 when the after report no longer holds a baseline finding', () => {
    const baseline = writeReport('removed-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('removed-after.json', LAPTOP_ROOT, withMessages(BABEL_CONFIG, []))
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).not.toContain(BABEL_CONFIG)
  })

  it('exits 0 when the after report holds no findings at all', () => {
    const baseline = writeReport('empty-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('empty-after.json', '[]')
    const {status} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
  })

  it('exits 1 when a finding occurs more often than the baseline recorded it', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, SCRIPT_ERROR])
    const baseline = writeReport('duplicate-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('duplicate-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_NEW_FINDINGS)
    expect(stdout).toContain(formatFinding(SCRIPT_FILE, SCRIPT_ERROR))
  })

  it('exits 1 and labels an added fatal message that carries no rule id', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, ADDED_SCRIPT_FATAL])
    const baseline = writeReport('fatal-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('fatal-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_NEW_FINDINGS)
    expect(stdout).toContain(positionOf(SCRIPT_FILE, ADDED_SCRIPT_FATAL))
    expect(stdout).toContain(ADDED_SCRIPT_FATAL.message)
    expect(stdout).not.toContain('null')
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
