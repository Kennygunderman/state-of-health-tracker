import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import process from 'node:process'

// Written as a dependency-free .mjs so the gate runs under plain node, outside Babel, Metro and the TypeScript
// program. A hit is fixed by adding a named token and referencing it — never by widening the lists below and
// never by adding an ignore comment, which this scanner deliberately does not honour.
const EXEMPT_VALUES = Object.freeze([
  '0',
  'auto',
  'undefined',
  'transparent',
  'currentColor',
  'row',
  'row-reverse',
  'column',
  'column-reverse',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
  'flex-start',
  'flex-end',
  'stretch',
  'baseline',
  'wrap',
  'nowrap',
  'absolute',
  'relative',
  'hidden',
  'visible',
  'uppercase',
  'lowercase',
  'capitalize',
  'line-through',
  'underline',
  'none',
  'normal',
  'bold',
  'italic',
  'left',
  'right',
  'top',
  'bottom',
  'contain',
  'cover',
  'solid',
  'dashed',
  'dotted'
])

const EXEMPT_PROPERTIES = Object.freeze(['flex', 'flexGrow', 'flexShrink'])

const FONT_WEIGHT_PROPERTY = 'fontWeight'

const QUOTE_CHARACTERS = Object.freeze(["'", '"', '`'])

const REASON_COLOR = 'hardcoded color'
const REASON_FONT_WEIGHT_STRING = 'quoted numeric font weight'
const REASON_NUMERIC = 'numeric literal'
const REASON_NUMERIC_STRING = 'quoted numeric literal'

const BIGINT_SUFFIX_PATTERN = /n$/
const COLOR_FUNCTION_PATTERN = /^(?:rgb|rgba|hsl|hsla)\(/
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/
const IDENTIFIER_CHARACTER_PATTERN = /[A-Za-z0-9_$]/
const NUMERIC_LITERAL_PATTERN =
  /-?(?:0[xX][\da-fA-F][\da-fA-F_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][-+]?\d[\d_]*)?)n?/g
const NUMERIC_SEPARATOR_PATTERN = /_/g
const NUMERIC_STRING_PATTERN = /^\d+$/
const PERCENTAGE_PATTERN = /^-?\d+(?:\.\d+)?%$/
const PROPERTY_PATTERN = /([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g

const REMEDY_LINES = Object.freeze([
  'Fix it by adding a named token and referencing it:',
  '  Sizes / Stroke / Opacity                -> src/styles/sizes.ts',
  '  LineHeight / LetterSpacing / FontWeight  -> src/styles/fontSize.ts',
  '  Spacing / BorderRadius / Shadow          -> src/styles/{spacing,borderRadius,shadow}.ts',
  '  a named color on Theme.colors            -> src/styles/theme.ts',
  'Do not widen the exemption list in this scanner and do not add an ignore comment.'
])

const isExemptValue = text => EXEMPT_VALUES.includes(text)

const isExemptProperty = propertyName => EXEMPT_PROPERTIES.includes(propertyName)

const isPercentage = text => PERCENTAGE_PATTERN.test(text)

const isQuoted = text => text.length > 1 && QUOTE_CHARACTERS.includes(text[0])

const unquote = text => (isQuoted(text) ? text.slice(1, -1) : text)

// Number() rejects numeric separators and a signed radix prefix; a magnitude that still resolves to NaN stays a hit.
const isZeroLiteral = text => {
  const bare = text.replace(NUMERIC_SEPARATOR_PATTERN, '').replace(BIGINT_SUFFIX_PATTERN, '')
  const magnitude = bare.startsWith('-') ? bare.slice(1) : bare

  return magnitude.length > 0 && Number(magnitude) === 0
}

const classifyValue = (propertyName, valueText) => {
  const literal = unquote(valueText)

  if (isExemptValue(literal) || isPercentage(literal)) {
    return null
  }

  if (isQuoted(valueText)) {
    if (NUMERIC_STRING_PATTERN.test(literal)) {
      return propertyName === FONT_WEIGHT_PROPERTY ? REASON_FONT_WEIGHT_STRING : REASON_NUMERIC_STRING
    }

    if (HEX_COLOR_PATTERN.test(literal) || COLOR_FUNCTION_PATTERN.test(literal)) {
      return REASON_COLOR
    }

    return null
  }

  if (isExemptProperty(propertyName) || isZeroLiteral(literal)) {
    return null
  }

  return REASON_NUMERIC
}

const maskLine = (line, insideBlockComment) => {
  const masked = line.split('')
  const strings = []
  let inComment = insideBlockComment
  let quote = null
  let openedAt = -1
  let index = 0

  while (index < line.length) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (inComment) {
      masked[index] = ' '

      if (character === '*' && nextCharacter === '/') {
        masked[index + 1] = ' '
        inComment = false
        index += 2
        continue
      }

      index += 1
      continue
    }

    if (quote) {
      masked[index] = ' '

      if (character === '\\') {
        if (index + 1 < line.length) {
          masked[index + 1] = ' '
        }

        index += 2
        continue
      }

      if (character === quote) {
        strings.push({index: openedAt, text: line.slice(openedAt, index + 1)})
        quote = null
        openedAt = -1
      }

      index += 1
      continue
    }

    if (character === '/' && nextCharacter === '/') {
      for (let rest = index; rest < line.length; rest += 1) {
        masked[rest] = ' '
      }

      break
    }

    if (character === '/' && nextCharacter === '*') {
      masked[index] = ' '
      masked[index + 1] = ' '
      inComment = true
      index += 2
      continue
    }

    if (QUOTE_CHARACTERS.includes(character)) {
      masked[index] = ' '
      quote = character
      openedAt = index
      index += 1
      continue
    }

    index += 1
  }

  return {code: masked.join(''), insideBlockComment: inComment, strings}
}

const findProperties = code =>
  [...code.matchAll(PROPERTY_PATTERN)].map(match => ({
    colonIndex: match.index + match[0].length - 1,
    name: match[1]
  }))

const propertyNameAt = (properties, index) =>
  properties.reduce((name, property) => (property.colonIndex < index ? property.name : name), '')

const findNumericLiterals = code =>
  [...code.matchAll(NUMERIC_LITERAL_PATTERN)]
    .filter(match => {
      const before = code[match.index - 1] ?? ''
      const after = code[match.index + match[0].length] ?? ''

      return !IDENTIFIER_CHARACTER_PATTERN.test(before) && !IDENTIFIER_CHARACTER_PATTERN.test(after)
    })
    .map(match => ({index: match.index, text: match[0]}))

const scanLine = (line, lineNumber, insideBlockComment) => {
  const {code, insideBlockComment: nextInsideBlockComment, strings} = maskLine(line, insideBlockComment)
  const properties = findProperties(code)
  const candidates = [...strings, ...findNumericLiterals(code)].sort((left, right) => left.index - right.index)

  for (const candidate of candidates) {
    const propertyName = propertyNameAt(properties, candidate.index)
    const reason = classifyValue(propertyName, candidate.text)

    if (reason) {
      const text = propertyName ? `${propertyName}: ${candidate.text}` : candidate.text
      const hit = {column: candidate.index + 1, line: lineNumber, reason, text}

      return {hit, insideBlockComment: nextInsideBlockComment}
    }
  }

  return {hit: null, insideBlockComment: nextInsideBlockComment}
}

const scanSource = source => {
  const lines = source.split('\n')
  let insideBlockComment = false

  for (let index = 0; index < lines.length; index += 1) {
    const result = scanLine(lines[index], index + 1, insideBlockComment)

    insideBlockComment = result.insideBlockComment

    if (result.hit) {
      return result.hit
    }
  }

  return null
}

const main = () => {
  const files = process.argv.slice(2)

  if (files.length === 0) {
    console.log('token-literal-scan: no styled files passed, nothing to scan')

    return
  }

  for (const file of files) {
    let source

    try {
      source = readFileSync(resolve(process.cwd(), file), 'utf8')
    } catch (error) {
      console.error(`token-literal-scan: cannot read ${file} (${error.code ?? 'unreadable'})`)
      process.exitCode = 2

      return
    }

    const hit = scanSource(source)

    if (hit) {
      console.error(`${file}:${hit.line}:${hit.column}  ${hit.text}  (${hit.reason})`)
      REMEDY_LINES.forEach(remedyLine => console.error(remedyLine))
      process.exitCode = 1

      return
    }
  }

  console.log(`token-literal-scan: ${files.length} file(s) scanned, no hardcoded style values found`)
}

main()
