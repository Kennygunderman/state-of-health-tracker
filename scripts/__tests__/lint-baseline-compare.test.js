// Plain JS on purpose: Jest's default testMatch collects .js but matches .mjs with neither pattern, so a suite for
// the .mjs lint gate can only be picked up in this form. The break is confined to scripts/ tooling.
import {execFileSync, spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import process from 'node:process'

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'lint-baseline-compare.mjs')
const TRACKED_BASELINE = path.resolve(process.cwd(), 'docs', 'lint-baseline.json')
const TRACKED_PROVENANCE = path.resolve(process.cwd(), 'docs', 'lint-baseline.provenance.json')

// The comparator exists to match findings across checkout roots, so the fixtures are captured under two
// deliberately unrelated absolute roots: a CI runner and a developer laptop.
const CI_ROOT = '/home/runner/work/app/mobile'
const LAPTOP_ROOT = '/Users/dev/projects/app/mobile'

const EXIT_OK = 0
const EXIT_GATE_FAILED = 1
const EXIT_INPUT_ERROR = 2

const USAGE_LINE = 'Usage: node scripts/lint-baseline-compare.mjs [--require <paths>] <baseline.json> <after.json>'
const STACK_FRAME = /\n\s+at\s/
const BASELINE_LABEL = 'the baseline report at'
const AFTER_LABEL = 'the after report at'
const PROVENANCE_LABEL = 'the provenance record at'
const NEW_FINDINGS_NOTE = 'new lint finding(s)'
const COVERAGE_NOTE = 'file(s) the baseline covers are absent from the after report'
const REQUIRED_NOTE = 'changed file(s) required of the after report are absent from it'
const EMPTY_AFTER_NOTE = 'the after report holds no results at all'

// Every fixture path but DELETED_FILE exists in this repository, which is what makes the coverage gate meaningful:
// the gate demands only the baseline paths a lint run today would still meet on disk.
const ESLINTRC = '.eslintrc.js'
const BABEL_CONFIG = 'babel.config.js'
const SCRIPT_FILE = 'scripts/transform-imports.js'
const STYLE_FILE = 'src/screens/Macros/index.styled.ts'
const DELETED_FILE = 'src/screens/RemovedByThisChange/index.ts'
const OUT_OF_SCOPE_FILE = 'docs/lint-baseline.provenance.json'
const SHAPE_FILE_PATH = `${CI_ROOT}/${STYLE_FILE}`

const DROPPED_RESULT_FIELDS = ['source', 'output']
const DROPPED_MESSAGE_FIELDS = ['fix', 'suggestions']

// The commit the tracked baseline was captured on, and the extensions that baseline covers. The gate derives the
// changed lintable files from these, so the suite derives them independently to check the same answer.
const BASE_COMMIT = '603718ee'
const LINTABLE_EXTENSIONS = new Set(['.js', '.ts', '.tsx'])
const CALLER_SUPPLIED_COVERAGE = {source: 'caller-supplied', baseCommit: null}

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

const FIXABLE_ERROR = {
  ruleId: 'prettier/prettier',
  severity: 2,
  message: 'Replace `·API_BASE_URL·` with `API_BASE_URL`',
  line: 1,
  column: 9,
  fix: {range: [8, 26], text: 'API_BASE_URL'},
  suggestions: [{messageId: 'replace', fix: {range: [8, 26], text: 'API_BASE_URL'}, desc: 'Replace it'}]
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
    suppressedMessages: [],
    ...(file.source === undefined ? {} : {source: file.source})
  }))

const withMessages = (relativePath, messages) =>
  BASELINE_FILES.map(file => (file.relativePath === relativePath ? {relativePath, messages} : file))

const withoutFile = relativePath => BASELINE_FILES.filter(file => file.relativePath !== relativePath)

const positionOf = (relativePath, message) => `${relativePath}:${message.line}:${message.column}`

const formatFinding = (relativePath, message) =>
  [positionOf(relativePath, message), message.ruleId, message.message].join('  ')

// An independent transcription of the projection and digest the comparator enforces, so a fixture's record states
// what the fixture actually holds and the two implementations cross-check each other.
const withoutFields = (record, fields) =>
  Object.fromEntries(Object.entries(record).filter(([field]) => !fields.includes(field)))

const projectResults = results =>
  results.map(result => {
    const projected = withoutFields(result, DROPPED_RESULT_FIELDS)

    if (Array.isArray(result.messages)) {
      projected.messages = result.messages.map(message => withoutFields(message, DROPPED_MESSAGE_FIELDS))
    }

    if (Array.isArray(result.suppressedMessages)) {
      projected.suppressedMessages = result.suppressedMessages.map(message =>
        withoutFields(message, DROPPED_MESSAGE_FIELDS)
      )
    }

    return projected
  })

const digestOf = results =>
  createHash('sha256')
    .update(JSON.stringify(projectResults(results)))
    .digest('hex')

const totalsOf = results => {
  const totals = {lintedFiles: results.length, filesWithFindings: 0, findings: 0, errors: 0, warnings: 0}

  for (const result of results) {
    const messages = result.messages ?? []

    if (messages.length > 0) {
      totals.filesWithFindings += 1
    }

    totals.findings += messages.length
    totals.errors += countSeverity(messages, 2)
    totals.warnings += countSeverity(messages, 1)
  }

  return totals
}

const provenanceFor = (results, overrides = {}) => ({
  artifact: 'fixture-baseline.json',
  sourceCommit: 'abc1234',
  capturedAt: 'before the change under test',
  captureCwd: 'the fixture repository root',
  captureScope: 'eslint .',
  captureCommand: 'npx eslint --no-fix -f json . -o fixture-baseline.json',
  projection: {droppedResultFields: DROPPED_RESULT_FIELDS, droppedMessageFields: DROPPED_MESSAGE_FIELDS},
  totals: totalsOf(results),
  digest: {algorithm: 'sha256', value: digestOf(results)},
  // A fixture baseline is not tied to a commit in this repository, so it says so and its changed files come from
  // --require; the tracked baseline uses git-diff, which the tracked-artifact cases below exercise.
  changedFileCoverage: CALLER_SUPPLIED_COVERAGE,
  ...overrides
})

const gitLines = args => execFileSync('git', args, {encoding: 'utf8', cwd: process.cwd()}).split('\n')

// The same derivation the gate performs, written independently: everything changed since the recorded base commit
// plus untracked files, narrowed to the lint scope and to paths that still exist.
const changedLintablePaths = () =>
  [
    ...new Set([
      ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', BASE_COMMIT, '--']),
      ...gitLines(['ls-files', '--others', '--exclude-standard'])
    ])
  ]
    .map(line => line.trim())
    .filter(
      relativePath =>
        relativePath !== '' &&
        LINTABLE_EXTENSIONS.has(path.extname(relativePath)) &&
        existsSync(path.resolve(process.cwd(), relativePath))
    )
    .sort()

const writeFixture = (name, contents) => {
  const filePath = path.join(fixtureDir, name)

  writeFileSync(filePath, contents, 'utf8')

  return filePath
}

const provenanceNameFor = name => `${name.replace(/\.json$/, '')}.provenance.json`

const writeReport = (name, root, files) => writeFixture(name, JSON.stringify(makeReport(root, files)))

// A baseline is only usable with its provenance record beside it, so every fixture baseline is written as the pair.
const writeBaseline = (name, root, files, overrides = undefined) => {
  const results = makeReport(root, files)
  const baselinePath = writeFixture(name, JSON.stringify(results))

  writeFixture(provenanceNameFor(name), JSON.stringify(provenanceFor(results, overrides)))

  return baselinePath
}

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

  it('uses fixture paths that exist in this repository, except the one standing for a deleted file', () => {
    for (const relativePath of [ESLINTRC, BABEL_CONFIG, SCRIPT_FILE, STYLE_FILE, OUT_OF_SCOPE_FILE]) {
      expect(existsSync(path.resolve(process.cwd(), relativePath))).toBe(true)
    }

    expect(existsSync(path.resolve(process.cwd(), DELETED_FILE))).toBe(false)
  })
})

describe('reports captured under different absolute roots', () => {
  it('exits 0 when both reports hold the same findings', () => {
    const baseline = writeBaseline('same-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('same-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).not.toContain(BABEL_CONFIG)
    expect(stdout).not.toContain(STYLE_FILE)
  })

  it('exits 1 and prints an added finding against its repo-relative path', () => {
    const files = withMessages(STYLE_FILE, [STYLE_FATAL, ADDED_STYLE_ERROR])
    const baseline = writeBaseline('added-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('added-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(STYLE_FILE, ADDED_STYLE_ERROR))
    expect(stdout).not.toContain(CI_ROOT)
    expect(stdout).not.toContain(LAPTOP_ROOT)
  })
})

describe('baseline coverage', () => {
  it('exits 0 when the after report no longer holds a baseline finding', () => {
    const baseline = writeBaseline('removed-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('removed-after.json', LAPTOP_ROOT, withMessages(BABEL_CONFIG, []))
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stdout).not.toContain(BABEL_CONFIG)
  })

  it('exits 1 when the after report holds no results at all', () => {
    const baseline = writeBaseline('empty-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeFixture('empty-after.json', '[]')
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(EMPTY_AFTER_NOTE)
    expect(stdout).toContain(COVERAGE_NOTE)
  })

  it('exits 1 and names a still-existing file the after report stopped covering', () => {
    const baseline = writeBaseline('uncovered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('uncovered-after.json', LAPTOP_ROOT, withoutFile(BABEL_CONFIG))
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(COVERAGE_NOTE)
    expect(stdout).toContain(BABEL_CONFIG)
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 0 when the only uncovered baseline path is a file this change deleted', () => {
    const files = [...BASELINE_FILES, {relativePath: DELETED_FILE, messages: []}]
    const baseline = writeBaseline('deleted-baseline.json', CI_ROOT, files)
    const after = writeReport('deleted-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stdout, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain('1 path(s) the baseline covers are no longer on disk')
    expect(stdout).not.toContain(COVERAGE_NOTE)
  })

  it('exits 1 when a finding occurs more often than the baseline recorded it', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, SCRIPT_ERROR])
    const baseline = writeBaseline('duplicate-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('duplicate-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(formatFinding(SCRIPT_FILE, SCRIPT_ERROR))
  })

  it('exits 1 and labels an added fatal message that carries no rule id', () => {
    const files = withMessages(SCRIPT_FILE, [SCRIPT_ERROR, ADDED_SCRIPT_FATAL])
    const baseline = writeBaseline('fatal-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('fatal-after.json', LAPTOP_ROOT, files)
    const {status, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(positionOf(SCRIPT_FILE, ADDED_SCRIPT_FATAL))
    expect(stdout).toContain(ADDED_SCRIPT_FATAL.message)
    expect(stdout).not.toContain('null')
  })
})

describe('changed files required of the after report', () => {
  it('exits 0 when every required file appears in the after report', () => {
    const baseline = writeBaseline('require-covered-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-covered-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status} = runComparator('--require', `${BABEL_CONFIG},${STYLE_FILE}`, baseline, after)

    expect(status).toBe(EXIT_OK)
  })

  it('exits 1 and names a required file the after report never linted', () => {
    const baseline = writeBaseline('require-missing-baseline.json', CI_ROOT, withoutFile(BABEL_CONFIG))
    const after = writeReport('require-missing-after.json', LAPTOP_ROOT, withoutFile(BABEL_CONFIG))
    const {status, stdout} = runComparator('--require', BABEL_CONFIG, baseline, after)

    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(REQUIRED_NOTE)
    expect(stdout).toContain(BABEL_CONFIG)
  })

  it('accepts a newline-separated list and a path given relative to the workspace root', () => {
    const baseline = writeBaseline('require-list-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-list-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const repoDirectory = path.basename(process.cwd())
    const {status} = runComparator(
      '--require',
      `${BABEL_CONFIG}\n${repoDirectory}/${SCRIPT_FILE}`,
      '--require',
      STYLE_FILE,
      baseline,
      after
    )

    expect(status).toBe(EXIT_OK)
  })

  it('skips a required path that no longer exists and one outside the lint scope', () => {
    const baseline = writeBaseline('require-skipped-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-skipped-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator('--require', `${DELETED_FILE},${OUT_OF_SCOPE_FILE}`, baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain('1 required path(s) no longer exist and were skipped')
    expect(stderr).toContain('1 required path(s) sit outside the lint scope')
    expect(stdout).not.toContain(REQUIRED_NOTE)
  })

  it('exits 2 when --require is given without a list', () => {
    const baseline = writeBaseline('require-no-value-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('require-no-value-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after, '--require')

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('--require needs a comma- or newline-separated list')
    expect(stderr).toContain(USAGE_LINE)
  })
})

describe('the provenance record beside the baseline', () => {
  it('exits 2 and names the record when it is absent', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const baseline = writeFixture('unrecorded-baseline.json', JSON.stringify(results))
    const after = writeReport('unrecorded-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(path.join(fixtureDir, 'unrecorded-baseline.provenance.json'))
    expect(stderr).toContain('every baseline is compared against its record')
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 2 when the record is not a JSON object', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const baseline = writeFixture('record-array-baseline.json', JSON.stringify(results))

    writeFixture('record-array-baseline.provenance.json', '[]')

    const after = writeReport('record-array-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`${PROVENANCE_LABEL} ${baseline.replace('.json', '.provenance.json')}`)
    expect(stderr).toContain('is not a provenance record')
  })

  it('exits 2 when the record does not say which commit the baseline was captured from', () => {
    const baseline = writeBaseline('record-no-commit-baseline.json', CI_ROOT, BASELINE_FILES, {sourceCommit: null})
    const after = writeReport('record-no-commit-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('needs a non-empty string "sourceCommit"')
  })

  it('exits 2 when the recorded totals disagree with the baseline', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const overrides = {totals: {...totalsOf(results), findings: totalsOf(results).findings + 1}}
    const baseline = writeBaseline('record-totals-baseline.json', CI_ROOT, BASELINE_FILES, overrides)
    const after = writeReport('record-totals-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`records totals.findings ${overrides.totals.findings}, the baseline holds 4`)
  })

  it('exits 2 when the baseline was edited under a record that still describes the original', () => {
    const results = makeReport(CI_ROOT, BASELINE_FILES)
    const edited = makeReport(CI_ROOT, withMessages(SCRIPT_FILE, [{...SCRIPT_ERROR, message: 'Edited message.'}]))
    const baseline = writeFixture('record-digest-baseline.json', JSON.stringify(edited))

    writeFixture('record-digest-baseline.provenance.json', JSON.stringify(provenanceFor(results)))

    const after = writeReport('record-digest-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(`records digest ${digestOf(results)}`)
    expect(stderr).toContain('recapturing the baseline is a reviewed change')
  })

  it('exits 2 when the baseline still holds a field the record claims was elided', () => {
    const files = BASELINE_FILES.map(file =>
      file.relativePath === STYLE_FILE ? {...file, source: 'const host = "https://example.test"\n'} : file
    )
    const baseline = writeBaseline('record-projection-baseline.json', CI_ROOT, files)
    const after = writeReport('record-projection-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('records result field(s) source as elided, but the baseline still holds them')
  })

  it('exits 2 when the record names its elided fields in the wrong shape', () => {
    const overrides = {projection: {droppedResultFields: 'source', droppedMessageFields: DROPPED_MESSAGE_FIELDS}}
    const baseline = writeBaseline('record-shape-baseline.json', CI_ROOT, BASELINE_FILES, overrides)
    const after = writeReport('record-shape-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('needs an array of field names at "projection.droppedResultFields"')
  })
})

describe('project mode', () => {
  it('elides the fields that embed file content and keeps every field the comparison keys on', () => {
    const files = withMessages(STYLE_FILE, [FIXABLE_ERROR]).map(file =>
      file.relativePath === STYLE_FILE ? {...file, source: 'const host = "https://example.test"\n'} : file
    )
    const raw = writeReport('project-raw.json', CI_ROOT, files)
    const projectedPath = path.join(fixtureDir, 'project-out.json')
    const {status, stdout} = runComparator('--project', raw, projectedPath)
    const projected = JSON.parse(readFileSync(projectedPath, 'utf8'))
    const styleEntry = projected.find(entry => entry.filePath.endsWith(STYLE_FILE))

    expect(status).toBe(EXIT_OK)
    expect(readFileSync(projectedPath, 'utf8')).not.toContain('example.test')
    expect(Object.keys(styleEntry)).not.toContain('source')
    expect(Object.keys(styleEntry.messages[0])).not.toContain('fix')
    expect(Object.keys(styleEntry.messages[0])).not.toContain('suggestions')
    expect(styleEntry.messages[0]).toMatchObject({
      ruleId: FIXABLE_ERROR.ruleId,
      message: FIXABLE_ERROR.message,
      line: FIXABLE_ERROR.line,
      column: FIXABLE_ERROR.column,
      severity: FIXABLE_ERROR.severity
    })
    expect(stdout).toContain('elided file content from 1 result(s) and fix payloads from 1 message(s)')
  })

  it('prints a provenance record for the projection with the descriptive fields left to be filled in', () => {
    const raw = writeReport('project-template-raw.json', CI_ROOT, BASELINE_FILES)
    const projectedPath = path.join(fixtureDir, 'project-template-out.json')
    const {status, stdout} = runComparator('--project', raw, projectedPath)
    const printed = JSON.parse(stdout.slice(stdout.indexOf('{')))

    expect(status).toBe(EXIT_OK)
    expect(printed.sourceCommit).toBeNull()
    expect(printed.captureCommand).toBeNull()
    expect(printed.totals).toEqual(totalsOf(makeReport(CI_ROOT, BASELINE_FILES)))
    expect(printed.digest).toEqual({algorithm: 'sha256', value: digestOf(makeReport(CI_ROOT, BASELINE_FILES))})
    expect(printed.projection.droppedResultFields).toEqual(DROPPED_RESULT_FIELDS)
  })

  it('writes a projection that its own record verifies, and projecting it again changes nothing', () => {
    const raw = writeReport('project-idempotent-raw.json', CI_ROOT, BASELINE_FILES)
    const firstPath = path.join(fixtureDir, 'project-idempotent-one.json')
    const secondPath = path.join(fixtureDir, 'project-idempotent-two.json')

    runComparator('--project', raw, firstPath)
    runComparator('--project', firstPath, secondPath)

    const first = readFileSync(firstPath, 'utf8')

    expect(readFileSync(secondPath, 'utf8')).toBe(first)

    writeFixture('project-idempotent-one.provenance.json', JSON.stringify(provenanceFor(JSON.parse(first))))

    const after = writeReport('project-idempotent-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status} = runComparator(firstPath, after)

    expect(status).toBe(EXIT_OK)
  })

  it('exits 2 without writing anything when the raw report is malformed', () => {
    const raw = writeFixture('project-malformed-raw.json', '{oops')
    const projectedPath = path.join(fixtureDir, 'project-malformed-out.json')
    const {status, stderr} = runComparator('--project', raw, projectedPath)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('is not valid JSON')
    expect(existsSync(projectedPath)).toBe(false)
  })

  it('exits 2 when project mode is combined with --require', () => {
    const raw = writeReport('project-require-raw.json', CI_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator('--project', '--require', BABEL_CONFIG, raw, 'unused.json')

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('belongs to compare mode and cannot be combined with --project')
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
    const record = JSON.parse(readFileSync(TRACKED_PROVENANCE, 'utf8'))

    expect(record.totals).toEqual({
      lintedFiles: 487,
      filesWithFindings: 31,
      findings: 49,
      errors: 34,
      warnings: 15
    })
    expect(record.sourceCommit).toContain('603718ee')
    expect(record.captureCommand).toBe('npx eslint --no-fix -f json . -o docs/lint-baseline.json')
    expect(record.captureScope).toContain('eslint .')
    expect(record.projection.droppedResultFields).toEqual(DROPPED_RESULT_FIELDS)
    expect(record.projection.droppedMessageFields).toEqual(DROPPED_MESSAGE_FIELDS)
  })

  it('carries no field that would embed a linted file, and so no host from one', () => {
    const results = artifact()
    const messages = results.flatMap(result => [...(result.messages ?? []), ...(result.suppressedMessages ?? [])])

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

  it('says the changed files are derived from the working tree against the recorded base commit', () => {
    const record = JSON.parse(readFileSync(TRACKED_PROVENANCE, 'utf8'))

    expect(record.changedFileCoverage.source).toBe('git-diff')
    expect(record.changedFileCoverage.baseCommit).toBe(BASE_COMMIT)
  })

  // The whole point of the derivation: the ordinary two-positional invocation — the one the AAP gate runs, with no
  // --require to forget — must reject a report that covers every path the baseline knew about yet skipped the files
  // this change added.
  it('exits 1 on an after report holding every baseline path but none of the changed files', () => {
    const afterPath = writeFixture('tracked-baseline-only-after.json', JSON.stringify(rerootedArtifact()))
    const {status, stdout} = runComparator(TRACKED_BASELINE, afterPath)
    const changed = changedLintablePaths()

    expect(changed.length).toBeGreaterThan(0)
    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(REQUIRED_NOTE)
    expect(stdout).toContain(changed[0])
  })

  it('exits 0 once the after report covers the baseline paths and the changed files as well', () => {
    const changed = changedLintablePaths()
    const after = [
      ...rerootedArtifact(),
      ...changed.map(relativePath => ({
        filePath: `${LAPTOP_ROOT}/${relativePath}`,
        messages: [],
        errorCount: 0,
        warningCount: 0,
        suppressedMessages: []
      }))
    ]
    const afterPath = writeFixture('tracked-complete-after.json', JSON.stringify(after))
    const {status, stdout, stderr} = runComparator(TRACKED_BASELINE, afterPath)

    // Changed files ESLint does not lint here (.mjs tooling, .json data) are reported as skipped, never demanded,
    // and no baseline path is missing from disk.
    expect(stderr).toContain('required path(s) sit outside the lint scope')
    expect(stderr).not.toContain('no longer on disk')
    expect(status).toBe(EXIT_OK)
    expect(stdout).toContain('all 487 baseline path(s) still on disk')
    expect(stdout).toContain(`all ${changed.length} changed lintable file(s) named by the working tree`)
  })
})

describe('deriving the changed files from the record', () => {
  it('exits 2 rather than skipping the check when the recorded base commit is not in this checkout', () => {
    const overrides = {changedFileCoverage: {source: 'git-diff', baseCommit: 'deadbee'}}
    const baseline = writeBaseline('derive-unknown-baseline.json', CI_ROOT, BASELINE_FILES, overrides)
    const after = writeReport('derive-unknown-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr, stdout} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('cannot resolve the recorded base commit deadbee')
    expect(stdout).not.toContain(NEW_FINDINGS_NOTE)
  })

  it('exits 2 when the record does not say where the changed files come from', () => {
    const baseline = writeBaseline('derive-absent-baseline.json', CI_ROOT, BASELINE_FILES, {
      changedFileCoverage: undefined
    })
    const after = writeReport('derive-absent-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('needs a "changedFileCoverage" object')
  })

  it('exits 2 when the record names a source it does not know', () => {
    const overrides = {changedFileCoverage: {source: 'trust-me', baseCommit: null}}
    const baseline = writeBaseline('derive-source-baseline.json', CI_ROOT, BASELINE_FILES, overrides)
    const after = writeReport('derive-source-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('changedFileCoverage.source to be one of git-diff, caller-supplied')
  })

  it("uses the caller's list instead of deriving when --require is given", () => {
    const overrides = {changedFileCoverage: {source: 'git-diff', baseCommit: 'deadbee'}}
    const baseline = writeBaseline('derive-override-baseline.json', CI_ROOT, BASELINE_FILES, overrides)
    const after = writeReport('derive-override-after.json', LAPTOP_ROOT, withoutFile(BABEL_CONFIG))
    const {status, stdout, stderr} = runComparator('--require', BABEL_CONFIG, baseline, after)

    expect(stderr).not.toContain('cannot resolve the recorded base commit')
    expect(status).toBe(EXIT_GATE_FAILED)
    expect(stdout).toContain(REQUIRED_NOTE)
    expect(stdout).toContain(BABEL_CONFIG)
  })

  it('says so on stderr when a record leaves the changed files to a caller who gave none', () => {
    const baseline = writeBaseline('derive-caller-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('derive-caller-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline, after)

    expect(status).toBe(EXIT_OK)
    expect(stderr).toContain('the record leaves the changed files to the caller and none were given')
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
    const baseline = writeBaseline('single-argument.json', CI_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator(baseline)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain(USAGE_LINE)
  })

  it('exits 2 and prints usage for an unknown option', () => {
    const baseline = writeBaseline('unknown-option-baseline.json', CI_ROOT, BASELINE_FILES)
    const after = writeReport('unknown-option-after.json', LAPTOP_ROOT, BASELINE_FILES)
    const {status, stderr} = runComparator('--strict', baseline, after)

    expect(status).toBe(EXIT_INPUT_ERROR)
    expect(stderr).toContain('unknown option --strict')
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
    const baseline = writeBaseline('malformed-after-baseline.json', CI_ROOT, BASELINE_FILES)
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
    const baseline = writeBaseline('shape-null-baseline.json', CI_ROOT, BASELINE_FILES)
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
    const baseline = writeBaseline('shape-file-path-baseline.json', CI_ROOT, BASELINE_FILES)
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
    const baseline = writeBaseline('shape-message-entry-baseline.json', CI_ROOT, BASELINE_FILES)
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
