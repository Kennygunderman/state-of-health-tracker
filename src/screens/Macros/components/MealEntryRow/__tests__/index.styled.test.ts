import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// A diary entry row is two stacked text blocks inside a padded row, so its height is entirely the sum of the
// boxes those two styles resolve to. Figma authors a line height on the provenance caption and leaves the name
// run automatic; the finding was that the automatic one was left unset, which hands a drawn row's height to
// whichever font the platform supplies.
const row = StyleSheet.flatten<ViewStyle>(styles.row)
const name = StyleSheet.flatten<TextStyle>(styles.name)
const servingText = StyleSheet.flatten<TextStyle>(styles.servingText)
const provenanceCaption = StyleSheet.flatten<TextStyle>(styles.provenanceCaption)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const nameBox = (): number => resolvedNumber(name.lineHeight, "the entry name's line box")

const captionBox = (): number => resolvedNumber(provenanceCaption.lineHeight, "the provenance caption's box")

const rowInset = (): number => resolvedNumber(row.paddingVertical, "the entry row's vertical inset")

const textBand = (): number => nameBox() + captionBox()

// What Figma resolves: node 38:264 declares no line height at node level or in either of its runs, so the
// automatic 15px box of 18 applies, and the provenance caption keeps the authored 18.85 below it.
const FIGMA_NAME_BOX = 18
const AUTHORED_CAPTION_BOX = 18.85

// The box React Native's platform font would invent from 15 x 1.21 with the height left unset, which is what
// the name run resolved to before this fix.
const PLATFORM_BOX = 18.15

describe('the entry name line box', () => {
  it('is the 18 Figma resolves for the name run rather than the platform font metric', () => {
    expect(nameBox()).toBe(LineHeight.BODY_COMPACT)
    expect(nameBox()).toBe(FIGMA_NAME_BOX)
    expect(nameBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it("is pinned at all, so the row height is the design's rather than the platform font's", () => {
    expect(name.lineHeight).toBeDefined()
  })

  it('carries the body size and semibold weight the name is drawn at', () => {
    expect(name.fontSize).toBe(FontSize.BODY)
    expect(name.fontWeight).toBe(FontWeight.SEMIBOLD)
  })

  // The node names Inter at node level and both of its runs override it back, so the comp's own family for
  // this text is the same one the rest of the app renders: adding a family here would be a real divergence.
  it('names no font family, leaving the platform family every other style in the app uses', () => {
    expect(name.fontFamily).toBeUndefined()
  })
})

describe('the serving text nested inside that same line', () => {
  // The component renders it as a span of the name Text, so it inherits this one box: giving it a size or a
  // box of its own would split a single drawn line into two.
  it("inherits the name's box and size instead of declaring either", () => {
    expect(servingText.lineHeight).toBeUndefined()
    expect(servingText.fontSize).toBeUndefined()
    expect(servingText.fontWeight).toBe(FontWeight.REGULAR)
  })
})

describe('the provenance caption below it', () => {
  it("keeps the box Figma authors on it rather than taking the name's", () => {
    expect(captionBox()).toBe(LineHeight.META)
    expect(captionBox()).toBeCloseTo(AUTHORED_CAPTION_BOX, 2)
    expect(captionBox()).not.toBe(nameBox())
  })

  it('is the meta style at the label size, which is what distinguishes it from the name', () => {
    expect(provenanceCaption.fontSize).toBe(FontSize.LABEL)
    expect(provenanceCaption.fontWeight).toBe(FontWeight.REGULAR)
  })
})

describe('the band the two blocks occupy', () => {
  it('stacks the pinned name box over the authored caption box, with no gap between them', () => {
    expect(textBand()).toBeCloseTo(FIGMA_NAME_BOX + AUTHORED_CAPTION_BOX, 2)
    expect(textBand()).toBeCloseTo(36.85, 2)
  })

  it('draws a provenance-labelled row as that band inside the row inset above and below it', () => {
    expect(rowInset()).toBe(Spacing.SMALL)
    expect(rowInset() * 2 + textBand()).toBeCloseTo(60.85, 2)
  })

  // What the unpinned name cost: every provenance-labelled row in the diary sat 0.15 short of the ladder the
  // design stacks them on, and the surplus compounded down a day's list.
  it('closes the 0.15 the platform box left each row short', () => {
    expect(PLATFORM_BOX - nameBox()).toBeCloseTo(0.15, 2)
    expect(Number.isInteger(nameBox())).toBe(true)
  })
})
