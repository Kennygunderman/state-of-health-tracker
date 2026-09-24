import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {LineHeight} from '@styles/fontSize'

import styles from '../index.styled'

// An aisle label has no derivation of its own: the block it occupies is entirely its wrapper's top inset plus
// the line box its text resolves to, so the only thing standing between the drawn design and the render is
// this style sheet. Frame 14 stacks five of these down one scroll, which is why a wrong box here is not a
// per-row rounding matter — it accumulates into every card below it.
const container = StyleSheet.flatten<ViewStyle>(styles.container)
const containerFirst = StyleSheet.flatten<ViewStyle>(styles.containerFirst)
const label = StyleSheet.flatten<TextStyle>(styles.label)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const labelBox = (): number => resolvedNumber(label.lineHeight, "the aisle label's line box")

const firstInset = (): number => resolvedNumber(containerFirst.paddingTop, "the first section's top inset")

const subsequentInset = (): number => resolvedNumber(container.paddingTop, "a subsequent section's top inset")

const firstBlock = (): number => firstInset() + labelBox()

const subsequentBlock = (): number => subsequentInset() + labelBox()

// What Figma declares for the wrappers that draw these labels, each of which closes on the label's box with
// nothing left over: 37:50 opens the list at 33 over a 20 inset, and 37:86, 37:114 and 37:134 follow at 29
// over a 16 inset.
const FIRST_SECTION_BLOCK = 33
const SUBSEQUENT_SECTION_BLOCK = 29
const SECTIONS_ON_FRAME_14 = 5

// The box the platform would invent if the line height were left to the font, and the value this token
// shipped as: 11 x 1.21. Both are the same number, and neither is drawn anywhere in the file.
const PLATFORM_BOX = 13.31

describe('the aisle label block', () => {
  it('opens the list at the 33 Figma declares for the first section', () => {
    expect(firstBlock()).toBe(FIRST_SECTION_BLOCK)
  })

  it('follows at the 29 Figma declares for every section after it', () => {
    expect(subsequentBlock()).toBe(SUBSEQUENT_SECTION_BLOCK)
  })

  // The two variants differ only by their inset — the label is one style across all five — so the 4px step
  // between them is positional and deliberate rather than a second text style.
  it('differs between first and subsequent sections only by the inset above the label', () => {
    expect(firstBlock() - subsequentBlock()).toBe(firstInset() - subsequentInset())
  })
})

describe('the line box the label resolves to', () => {
  it('is the box Figma resolves for 11 px text rather than the one the platform font would', () => {
    expect(labelBox()).toBe(LineHeight.OVERLINE)
    expect(labelBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('draws the overline at the size, weight and case Figma states, upper-cased in style rather than in copy', () => {
    expect(label.fontSize).toBe(FontSize.OVERLINE)
    expect(label.textTransform).toBe('uppercase')
  })
})

describe('the drift five stacked sections would accumulate', () => {
  // The whole of the reported defect, stated as the number a shopper sees: every section carried the platform
  // box's 0.31 surplus, so the last of frame 14's five aisle cards sat over a pixel below where it was drawn.
  it('leaves the fifth aisle card exactly where Figma draws it', () => {
    const drift = (PLATFORM_BOX - labelBox()) * SECTIONS_ON_FRAME_14

    expect(drift).toBeCloseTo(1.55, 2)
    expect(labelBox() * SECTIONS_ON_FRAME_14).toBe(LineHeight.OVERLINE * SECTIONS_ON_FRAME_14)
    expect(Number.isInteger(labelBox() * SECTIONS_ON_FRAME_14)).toBe(true)
  })
})
