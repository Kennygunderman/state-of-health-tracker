import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'

import styles from '../index.styled'

// The badge is a painted pill that hugs its one label, so nothing but this sheet decides its height: Figma
// renders 49:357 at exactly 16, which is the 2px inset above, the label's box, and the 2px inset below. The
// finding was the middle term of that sum being left to whichever font the platform supplies.
const badge = StyleSheet.flatten<ViewStyle>(styles.badge)
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

const labelBox = (): number => resolvedNumber(label.lineHeight, "the badge label's line box")

const badgeInset = (): number => resolvedNumber(badge.paddingVertical, "the badge's vertical inset")

const badgeHeight = (): number => badgeInset() * 2 + labelBox()

// What Figma renders: the painted badge 49:357 is 16.000 tall and its label 49:358 declares no line height,
// so the box is the automatic 10px one — 12.
const FIGMA_BADGE_HEIGHT = 16
const FIGMA_LABEL_BOX = 12

// The box React Native's platform font would invent from 10 x 1.21 with the height left unset, which is what
// the badge hugged to before this fix.
const PLATFORM_BOX = 12.1

describe('the LOGGED badge line box', () => {
  it('is the 12 Figma resolves for 10 px text rather than the platform font metric', () => {
    expect(labelBox()).toBe(LineHeight.TAB_LABEL)
    expect(labelBox()).toBe(FIGMA_LABEL_BOX)
    expect(labelBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('is pinned at all, so the badge hugs to one height on both platforms', () => {
    expect(label.lineHeight).toBeDefined()
  })

  it('carries the day-strip size, weight and letter spacing the badge is drawn with', () => {
    expect(label.fontSize).toBe(FontSize.TAB_LABEL)
    expect(label.fontWeight).toBe(FontWeight.SEMIBOLD)
    expect(label.letterSpacing).toBe(LetterSpacing.OVERLINE)
  })

  // Node 49:358 carries no text case — the capitals are in the string the component renders — so upper-casing
  // it in style would be inventing a property the design does not declare.
  it('upper-cases nothing in style, because the node declares no text case', () => {
    expect(label.textTransform).toBeUndefined()
  })
})

describe('the height the badge hugs to', () => {
  it('is the 16 Figma renders, spent as 2 + 12 + 2', () => {
    expect(badgeInset()).toBe(Sizes.BADGE_PADDING_V)
    expect(badgeHeight()).toBe(FIGMA_BADGE_HEIGHT)
    expect(badgeHeight()).toBe(Sizes.BADGE_PADDING_V + FIGMA_LABEL_BOX + Sizes.BADGE_PADDING_V)
  })

  it('hugs rather than pinning a height, so the pill still grows with the text size', () => {
    expect(badge.height).toBeUndefined()
    expect(badge.minHeight).toBeUndefined()
    expect(badge.maxHeight).toBeUndefined()
  })

  // The badge's authored 6px gap is inert with a single child, so encoding it would add a value nothing draws.
  it('encodes no gap, having one child for the authored gap to separate', () => {
    expect(badge.gap).toBeUndefined()
    expect(badge.columnGap).toBeUndefined()
    expect(badge.rowGap).toBeUndefined()
  })
})
