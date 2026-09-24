import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {LineHeight} from '@styles/fontSize'
import {readFileSync} from 'node:fs'

import {SummaryRowValueSize} from '../index'
import styles from '../index.styled'

// These rows have no derivation of their own: the value's line box, the wrapper its insets close, the row
// that stacks a label over it and the card the six rows fill are decided entirely by the style objects the
// component composes, so those objects and the order it composes them in are what is under test. The
// reference numbers are the reconciled Figma specification for the three cards this component draws — 34:98
// (Review answers, the stacked variant, the one card that AUTHORS a 19.5 value box) and 34:325 / 34:389
// (Generating and Generation failed, the inline variant, whose values author nothing and resolve to 18).
const FIGMA_STACKED_VALUE_BOX = 19.5
const FIGMA_STACKED_VALUE_WRAPPER = 22
const FIGMA_STACKED_ROW = 62
const FIGMA_WRAPPING_STACKED_ROW = 81.5
const FIGMA_ANSWERS_CARD = 396
const FIGMA_INLINE_VALUE_BOX = 18
const FIGMA_INLINE_LABEL_BOX = 18.85
const FIGMA_LABEL_SIZE_VALUE_BOX = 16

// The Review answers card draws six rows, and exactly one of them — "Diet and allergies" (34:116, measured at
// 39.0 = 2 x 19.5) — wraps at the 393 px reference width.
const ANSWER_ROWS = 6
const WRAPPING_ANSWER_ROWS = 1

// What the card measured while the screen passed no `valueSize` — the review's own figure for six unwrapped
// rows at the 13 px label treatment, recorded rather than recomputed, because the stacked variant no longer
// has a state that draws it.
const LABEL_SIZE_ANSWERS_CARD = 356

// What the implementation resolves: five 62 px rows, the 81.5 px wrapping row and five 1 px dividers. The
// 0.5 px against Figma's 396.000 is authoring slack on the fixed 34:98 frame — the two-line row is drawn at
// 41 over the same 2 / 0.5 insets the single-line rows close at 22 — and the specification says not to
// reproduce a frame's fixed height.
const IMPLEMENTED_ANSWERS_CARD = 396.5

// The finding's own PASS criterion, which that residual sits inside.
const PASS_TOLERANCE = 1

// Guarded rather than cast, and read inside the tests rather than at module scope: a style value that stops
// being a number — dropped, or authored as a percentage string — has to fail the assertion that states what
// it is for instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// Mirrors the array the component composes for a value: the size variant, then the stacked or inline variant,
// so the card's own box wins wherever the two disagree. Composing it here is the point — the stacked card's
// 19.5 only reaches the screen because it sits on the later entry.
const valueStyle = (valueSize: SummaryRowValueSize, divided: boolean): TextStyle =>
  StyleSheet.flatten<TextStyle>([
    styles.value,
    valueSize === 'body' ? styles.valueBody : styles.valueLabel,
    divided ? styles.valueStacked : styles.valueInline
  ])

const labelStyle = (divided: boolean): TextStyle =>
  StyleSheet.flatten<TextStyle>(divided ? styles.label : [styles.label, styles.labelInline])

const lineBox = (style: TextStyle, description: string): number => resolvedNumber(style.lineHeight, description)

// The painted wrapper around a stacked value: the 2 px and 0.5 px insets Figma draws, over as many line boxes
// as the value takes.
const valueWrapper = (valueSize: SummaryRowValueSize, lines: number): number => {
  const stacked = StyleSheet.flatten<TextStyle>(styles.valueStacked)
  const box = lineBox(valueStyle(valueSize, true), `the stacked ${valueSize} value's line box`)

  return (
    resolvedNumber(stacked.paddingTop, "the stacked value's top inset") +
    box * lines +
    resolvedNumber(stacked.paddingBottom, "the stacked value's bottom inset")
  )
}

const stackedRow = (valueSize: SummaryRowValueSize, valueLines: number): number => {
  const row = StyleSheet.flatten<ViewStyle>(styles.rowStacked)
  const rowPadding = resolvedNumber(row.paddingVertical, "the stacked row's vertical padding")
  const labelBox = lineBox(labelStyle(true), "the stacked label's line box")

  return rowPadding * 2 + labelBox + valueWrapper(valueSize, valueLines)
}

const answersCard = (valueSize: SummaryRowValueSize, wrappingRows: number): number => {
  const divider = resolvedNumber(
    StyleSheet.flatten<ViewStyle>(styles.rowDivider).borderTopWidth,
    'the divider every answer row after the first carries'
  )

  return (
    stackedRow(valueSize, 1) * (ANSWER_ROWS - wrappingRows) +
    stackedRow(valueSize, 2) * wrappingRows +
    divider * (ANSWER_ROWS - 1)
  )
}

// The screen that draws the answers card is another module, and the prop it passes is the whole of the
// review's HIGH finding: the six values render at 13 px with no box unless it selects the body treatment.
// There is no renderer in this project to mount the screen with, so the element is read from its source, and
// read defensively: the screen is co-owned, so it is keyed on the rows argument it passes rather than on
// being the file's first SummaryRows, closed at the first `>` so either closing form matches, and collapsed
// to single spaces so reformatting the attributes across lines cannot fail the assertion.
const ANSWERS_ROWS_ARGUMENT = 'answerRows'

const answersCardElement = (): string => {
  const source = readFileSync(require.resolve('@screens/MealPlanTargets'), 'utf8')
  const element = source
    .split('<SummaryRows')
    .slice(1)
    .map(candidate => candidate.slice(0, candidate.indexOf('>')).replace(/\s+/g, ' '))
    .find(candidate => candidate.includes(ANSWERS_ROWS_ARGUMENT))

  if (element === undefined) {
    throw new Error('Expected the Review screen to render a SummaryRows element for its answers card')
  }

  return element
}

describe('the Review answers card (34:98), which SummaryRows draws as its stacked variant', () => {
  it('pins the value at the 15 px / 19.5 px style the six answer rows declare', () => {
    const value = valueStyle('body', true)

    expect(resolvedNumber(value.fontSize, "the stacked value's size")).toBe(FontSize.BODY)
    expect(lineBox(value, "the stacked value's line box")).toBe(FIGMA_STACKED_VALUE_BOX)
    expect(lineBox(value, "the stacked value's line box")).toBe(LineHeight.ROW_VALUE)
  })

  it('carries that authored box on the stacked variant, beside the insets that belong to this one card', () => {
    const stacked = StyleSheet.flatten<TextStyle>(styles.valueStacked)

    expect(lineBox(stacked, "the stacked variant's own line box")).toBe(LineHeight.ROW_VALUE)
    expect(lineBox(valueStyle('label', true), 'the stacked 13 px value box')).toBe(LineHeight.ROW_VALUE)
  })

  it('closes the 22 px value wrapper Figma draws on the 2 px and 0.5 px insets', () => {
    expect(valueWrapper('body', 1)).toBe(FIGMA_STACKED_VALUE_WRAPPER)
  })

  it('measures one answer row at the 62 px Figma row', () => {
    expect(stackedRow('body', 1)).toBe(FIGMA_STACKED_ROW)
  })

  it('charges only a second line box for the one value that wraps', () => {
    expect(valueWrapper('body', 2) - valueWrapper('body', 1)).toBe(FIGMA_STACKED_VALUE_BOX)
    expect(stackedRow('body', 2)).toBe(FIGMA_WRAPPING_STACKED_ROW)
  })

  it('fills the answers card to the 396 px Figma frame, inside the 1 px tolerance', () => {
    const card = answersCard('body', WRAPPING_ANSWER_ROWS)

    expect(card).toBe(IMPLEMENTED_ANSWERS_CARD)
    expect(Math.abs(card - FIGMA_ANSWERS_CARD)).toBeLessThanOrEqual(PASS_TOLERANCE)
  })

  it('recovers the 40 px the card was short while its values fell back to the label treatment', () => {
    const card = answersCard('body', WRAPPING_ANSWER_ROWS)

    expect(Math.abs(LABEL_SIZE_ANSWERS_CARD - FIGMA_ANSWERS_CARD)).toBeGreaterThan(PASS_TOLERANCE)
    expect(card - LABEL_SIZE_ANSWERS_CARD).toBeGreaterThanOrEqual(FIGMA_ANSWERS_CARD - LABEL_SIZE_ANSWERS_CARD)
  })
})

describe('the Review screen, which has to select that treatment', () => {
  it('renders its answers rows as the divided card at the body value size', () => {
    const element = answersCardElement()

    expect(element).toMatch(/valueSize=(?:"body"|{'body'})/)
    expect(element).toMatch(/\bdivided\b/)
  })
})

describe('the inline summary cards (34:325 and 34:389)', () => {
  it('leaves the 15 px value on the automatic 18 px box those cards resolve', () => {
    const value = valueStyle('body', false)

    expect(resolvedNumber(value.fontSize, "the inline value's size")).toBe(FontSize.BODY)
    expect(lineBox(value, "the inline value's line box")).toBe(FIGMA_INLINE_VALUE_BOX)
    expect(lineBox(value, "the inline value's line box")).toBe(LineHeight.BODY_COMPACT)
    expect(lineBox(value, "the inline value's line box")).not.toBe(LineHeight.ROW_VALUE)
  })

  it('keeps the label on the 18.85 box those same cards author, so the two axes stay distinct', () => {
    expect(lineBox(labelStyle(false), "the inline label's line box")).toBe(FIGMA_INLINE_LABEL_BOX)
    expect(lineBox(labelStyle(false), "the inline label's line box")).toBe(LineHeight.META)
  })

  it('pins the 13 px value at its own automatic 16 px box rather than a platform metric', () => {
    const value = valueStyle('label', false)

    expect(resolvedNumber(value.fontSize, "the 13 px inline value's size")).toBe(FontSize.LABEL)
    expect(lineBox(value, "the 13 px inline value's line box")).toBe(FIGMA_LABEL_SIZE_VALUE_BOX)
    expect(lineBox(value, "the 13 px inline value's line box")).toBe(LineHeight.LABEL)
  })

  it('aligns no value text, leaving the right-hand look to the row it sits in', () => {
    const inlineRow = StyleSheet.flatten<ViewStyle>(styles.rowInline)

    expect(valueStyle('body', false).textAlign).toBeUndefined()
    expect(valueStyle('label', false).textAlign).toBeUndefined()
    expect(StyleSheet.flatten<TextStyle>(styles.valueInline).textAlign).toBeUndefined()
    expect(inlineRow.justifyContent).toBe('space-between')
  })

  it('keeps the inline value shrinkable, so a long answer wraps inside its own half of the row', () => {
    expect(valueStyle('body', false).flexShrink).toBe(1)
  })
})
