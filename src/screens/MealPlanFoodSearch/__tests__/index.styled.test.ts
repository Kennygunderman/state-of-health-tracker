import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// Two 13px regular captions ship from this sheet and they are not the same text style. The footnote under the
// search field is drawn (node 47:451) inside a wrapper Figma fixes at 353 x 24, so its line box is the
// automatic one; the empty-result caption has no node at all, wraps, and keeps the authored multi-line box.
// Collapsing them in either direction is the defect, so both are asserted here.
const helperText = StyleSheet.flatten<TextStyle>(styles.helperText)
const emptyCaption = StyleSheet.flatten<TextStyle>(styles.emptyCaption)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const helperBox = (): number => resolvedNumber(helperText.lineHeight, "the footnote's line box")

const helperInset = (): number => resolvedNumber(helperText.paddingTop, "the footnote's top inset")

const helperBlock = (): number => helperInset() + helperBox()

const emptyBox = (): number => resolvedNumber(emptyCaption.lineHeight, "the empty-result caption's line box")

// What Figma draws: node 47:451 ("Adding here only affects recipe suggestions.") declares no line height, so
// the design resolves the automatic 13px box, and wrapper 47:450 closes on 24 with nothing left over.
const FIGMA_FOOTNOTE_BLOCK = 24
const FIGMA_FOOTNOTE_BOX = 16

// The box Figma authors on the multi-line meta style — carried by the result-row categories through
// style_380213a2, and by this sheet's own wrapping empty-result caption — and the box React Native's platform
// font would invent from 13 x 1.21 if the line height were left unset.
const AUTHORED_MULTILINE_BOX = 18.85
const PLATFORM_BOX = 15.73

describe('the food-search footnote block', () => {
  it('draws the 24 px block Figma fixes its wrapper at', () => {
    expect(helperBlock()).toBe(FIGMA_FOOTNOTE_BLOCK)
  })

  it('spends that block as the drawn inset over the drawn line box, with nothing left over', () => {
    expect(helperInset()).toBe(Spacing.X_SMALL)
    expect(helperBox()).toBe(FIGMA_FOOTNOTE_BOX)
  })

  it('is the box Figma resolves for a single 13 px line rather than the authored multi-line box', () => {
    expect(helperBox()).toBe(LineHeight.LABEL)
    expect(helperBox()).not.toBe(LineHeight.META)
    expect(helperBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })

  it('is pinned rather than left to the platform font metric', () => {
    expect(helperText.lineHeight).toBeDefined()
    expect(helperBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  // The whole of the reported defect, stated as the number the frame was out by: 18.85 stretched a wrapper
  // with 24 to give to 26.85.
  it('no longer overflows its fixed wrapper by the 2.85 the multi-line box would add', () => {
    expect(helperInset() + AUTHORED_MULTILINE_BOX - helperBlock()).toBeCloseTo(2.85, 2)
    expect(helperBlock()).toBeLessThanOrEqual(FIGMA_FOOTNOTE_BLOCK)
  })

  it('keeps the size, weight and regular-meta identity the footnote shares with its Figma node', () => {
    expect(helperText.fontSize).toBe(FontSize.LABEL)
    expect(helperText.fontWeight).toBe(FontWeight.REGULAR)
  })
})

describe('the empty-result caption beside it', () => {
  // This one is inferred rather than drawn and genuinely wraps, so the authored multi-line leading is right
  // for it. Pinned here so a future sweep of the 13px captions cannot quietly take it along.
  it('keeps the authored multi-line box, which is correct for a caption that wraps', () => {
    expect(emptyBox()).toBe(LineHeight.META)
    expect(emptyBox()).toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })

  it("shares the footnote's size and weight while differing on exactly the line box", () => {
    expect(emptyCaption.fontSize).toBe(helperText.fontSize)
    expect(emptyCaption.fontWeight).toBe(helperText.fontWeight)
    expect(emptyBox()).not.toBe(helperBox())
  })
})
