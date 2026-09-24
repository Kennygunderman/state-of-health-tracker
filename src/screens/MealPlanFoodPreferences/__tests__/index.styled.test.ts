import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// The helper caption under the chip cloud has no derivation of its own: the block it draws is its own top
// inset plus the line box its text resolves to, so this style sheet is the whole of what stands between the
// drawn frame and the render. Figma fixes the wrapper that holds it (47:322) at 353 x 24, which cannot absorb
// a taller line — the caption would either overflow the wrapper or push what follows it down the frame.
const helperText = StyleSheet.flatten<TextStyle>(styles.helperText)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const helperBox = (): number => resolvedNumber(helperText.lineHeight, "the helper caption's line box")

const helperInset = (): number => resolvedNumber(helperText.paddingTop, "the helper caption's top inset")

const helperBlock = (): number => helperInset() + helperBox()

// What Figma draws: node 47:323 ("Add allergies on the previous screen instead.") declares no line height, so
// the design resolves the automatic 13px box, and its wrapper closes on 24 with nothing left over.
const FIGMA_HELPER_BLOCK = 24
const FIGMA_HELPER_BOX = 16

// The box the multi-line meta style authors — correct on the result-row categories, which declare it, and
// 2.85 too tall here — and the box React Native's platform font would invent from 13 x 1.21 if the line
// height were left unset. Neither is what this wrapper is drawn at.
const AUTHORED_MULTILINE_BOX = 18.85
const PLATFORM_BOX = 15.73

describe('the food-preferences helper caption block', () => {
  it('draws the 24 px block Figma fixes its wrapper at', () => {
    expect(helperBlock()).toBe(FIGMA_HELPER_BLOCK)
  })

  it('spends that block as the drawn inset over the drawn line box, with nothing left over', () => {
    expect(helperInset()).toBe(Spacing.X_SMALL)
    expect(helperBox()).toBe(FIGMA_HELPER_BOX)
  })
})

describe('the line box the caption resolves to', () => {
  it('is the box Figma resolves for a single 13 px line rather than the one it authors on multi-line meta', () => {
    expect(helperBox()).toBe(LineHeight.LABEL)
    expect(helperBox()).not.toBe(LineHeight.META)
    expect(helperBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })

  it('is pinned rather than left to the platform font metric', () => {
    expect(helperText.lineHeight).toBeDefined()
    expect(helperBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  // The whole of the reported defect, stated as the number the frame is out by: 18.85 stretched a wrapper
  // with 24 to give to 26.85.
  it('no longer overflows its fixed wrapper by the 2.85 the multi-line box would add', () => {
    expect(helperInset() + AUTHORED_MULTILINE_BOX - helperBlock()).toBeCloseTo(2.85, 2)
    expect(helperBlock()).toBeLessThanOrEqual(FIGMA_HELPER_BLOCK)
  })

  it('keeps the size, weight and regular-meta identity the caption shares with its Figma node', () => {
    expect(helperText.fontSize).toBe(FontSize.LABEL)
    expect(helperText.fontWeight).toBe(FontWeight.REGULAR)
  })
})
