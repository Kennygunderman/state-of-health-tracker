import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// The "Food allergies" label and the helper caption beneath the allergen cloud are the same 13px type at the
// same size, and Figma authors a line height on neither: both resolve to the automatic 16px box, and both of
// their wrappers close on it exactly (47:175 at 353 x 40, the helper's 47:322 at 353 x 24). The finding was
// the pair disagreeing — the helper pinned the multi-line box while the label pinned nothing at all.
const sectionLabel = StyleSheet.flatten<TextStyle>(styles.sectionLabel)
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

const labelBox = (): number => resolvedNumber(sectionLabel.lineHeight, "the section label's line box")

const labelInset = (): number => resolvedNumber(sectionLabel.paddingTop, "the section label's top inset")

const helperBox = (): number => resolvedNumber(helperText.lineHeight, "the helper caption's line box")

const helperInset = (): number => resolvedNumber(helperText.paddingTop, "the helper caption's top inset")

// What Figma draws: wrapper 47:322 fixes the helper block at 24 over 8/0/0 padding, and wrapper 47:175 fixes
// the label block at 40 over its 24 inset. Both remainders are the same 16px box.
const FIGMA_HELPER_BLOCK = 24
const FIGMA_LABEL_BLOCK = 40
const FIGMA_BOX = 16

// The multi-line meta box this helper shipped with — correct where Figma declares it, such as the Activity
// info body — and the box the platform font would invent from 13 x 1.21 with the height left unset, which is
// what the label resolved to.
const AUTHORED_MULTILINE_BOX = 18.85
const PLATFORM_BOX = 15.73

describe('the helper caption under the allergen cloud', () => {
  it('draws the 24 px block the fixed wrapper Figma gives it closes on', () => {
    expect(helperInset()).toBe(Spacing.X_SMALL)
    expect(helperBox()).toBe(FIGMA_BOX)
    expect(helperInset() + helperBox()).toBe(FIGMA_HELPER_BLOCK)
  })

  it('takes the box Figma resolves rather than the multi-line box it authors elsewhere', () => {
    expect(helperBox()).toBe(LineHeight.LABEL)
    expect(helperBox()).not.toBe(LineHeight.META)
    expect(helperBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })

  // The defect stated as the number: 8 + 18.85 drew the block at 26.85 (measured at 26.844 on the review's
  // screenshot, the renderer's own rounding of the same value) inside a wrapper with 24 to give — and a
  // wrapper that cannot grow clips a wrapped line rather than shifting it, because the single line already
  // fills the column.
  it('sheds the 2.85 px the multi-line box added to a wrapper that cannot absorb it', () => {
    expect(helperInset() + AUTHORED_MULTILINE_BOX).toBeCloseTo(26.85, 2)
    expect(helperInset() + AUTHORED_MULTILINE_BOX - (helperInset() + helperBox())).toBeCloseTo(2.85, 2)
  })
})

describe('the "Food allergies" label the finding names as its divergent sibling', () => {
  it('draws the 40 px block Figma fixes its wrapper at', () => {
    expect(labelInset()).toBe(Spacing.LARGE)
    expect(labelBox()).toBe(FIGMA_BOX)
    expect(labelInset() + labelBox()).toBe(FIGMA_LABEL_BLOCK)
  })

  it('pins that box rather than inheriting the platform font metric', () => {
    expect(sectionLabel.lineHeight).toBeDefined()
    expect(labelBox()).toBe(LineHeight.LABEL)
    expect(labelBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })
})

describe('the agreement between the two', () => {
  it('resolves both 13 px styles to one box, which is what the finding asked for', () => {
    expect(labelBox()).toBe(helperBox())
    expect(labelBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
    expect(helperBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('keeps them distinct where Figma distinguishes them, on weight and colour rather than leading', () => {
    expect(sectionLabel.fontSize).toBe(FontSize.LABEL)
    expect(helperText.fontSize).toBe(FontSize.LABEL)
    expect(sectionLabel.fontWeight).toBe(FontWeight.SEMIBOLD)
    expect(helperText.fontWeight).toBe(FontWeight.REGULAR)
    expect(sectionLabel.color).not.toBe(helperText.color)
  })
})
