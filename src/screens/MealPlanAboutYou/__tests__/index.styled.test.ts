import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// Four field labels and the prefill caption under the Age field are the same 13px type at the same size,
// drawn in the same stacked column, and the caption's own comment records why its line box is pinned. The
// finding here was that the labels were not: their box came from the platform font instead, so two visually
// identical styles resolved to different heights and every group below them shifted by the difference.
const fieldLabel = StyleSheet.flatten<TextStyle>(styles.fieldLabel)
const prefillCaption = StyleSheet.flatten<TextStyle>(styles.prefillCaption)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const labelBox = (): number => resolvedNumber(fieldLabel.lineHeight, "a field label's line box")

const captionBox = (): number => resolvedNumber(prefillCaption.lineHeight, "the prefill caption's line box")

const captionInset = (): number => resolvedNumber(prefillCaption.paddingTop, "the prefill caption's top inset")

// The box Figma resolves for 13px text with no authored line height, established on this screen by the Age
// label's own wrapper, and the caption row it closes: node 46:359 is X_SMALL + 16 = 24.
const FIGMA_LABEL_BOX = 16
const FIGMA_CAPTION_BLOCK = 24

// What the platform font would invent from 13 x 1.21 if the box were left unset — the value the labels
// resolved to before this fix — and the multi-line meta box, which is 2.85 too tall for a single line.
const PLATFORM_BOX = 15.73
const AUTHORED_MULTILINE_BOX = 18.85

describe('the field label line box', () => {
  it('is the 16 Figma resolves for 13 px text rather than the platform font metric', () => {
    expect(labelBox()).toBe(LineHeight.LABEL)
    expect(labelBox()).toBe(FIGMA_LABEL_BOX)
    expect(labelBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('is pinned at all, so no platform decides the height of a drawn row', () => {
    expect(fieldLabel.lineHeight).toBeDefined()
  })

  it('is not the multi-line meta box either, which would stretch every label row by 2.85', () => {
    expect(labelBox()).not.toBe(LineHeight.META)
    expect(labelBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })
})

describe('the consistency the finding reported as broken', () => {
  // The defect stated as the number: both boxes belong to the same 13 px automatic style, and they differed
  // by the 0.27 the platform multiplier produces.
  it('resolves to exactly the box its sibling caption pins', () => {
    expect(labelBox()).toBe(captionBox())
  })

  it("shares the caption's size while keeping its own weight, which is the only difference between them", () => {
    expect(fieldLabel.fontSize).toBe(prefillCaption.fontSize)
    expect(fieldLabel.fontSize).toBe(FontSize.LABEL)
    expect(fieldLabel.fontWeight).toBe(FontWeight.SEMIBOLD)
    expect(prefillCaption.fontWeight).toBe(FontWeight.REGULAR)
  })

  it('leaves the caption row on the 24 px block Figma draws it at', () => {
    expect(captionInset()).toBe(Spacing.X_SMALL)
    expect(captionInset() + captionBox()).toBe(FIGMA_CAPTION_BLOCK)
  })
})

describe('the label row geometry that box decides', () => {
  // The labels sit in a row that also holds the unit toggle, so the row grows to the taller of the two and
  // the label carries no inset of its own — the box alone is what the row is drawn from.
  it('adds no padding of its own, so the box is the whole of the label height', () => {
    expect(fieldLabel.paddingTop).toBeUndefined()
    expect(fieldLabel.paddingBottom).toBeUndefined()
    expect(fieldLabel.paddingVertical).toBeUndefined()
  })

  it('shrinks rather than pins a width, so a long label wraps inside the row instead of clipping it', () => {
    expect(fieldLabel.flexShrink).toBe(1)
    expect(fieldLabel.width).toBeUndefined()
  })
})
