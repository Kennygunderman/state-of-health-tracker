import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// The "Servings" label opens the control block, and nothing but this sheet decides where the stepper beneath
// it starts: the block is the label's own top inset plus the line box its text resolves to. The finding was
// the box being left unset, which hands a drawn position to whichever font the platform supplies.
const controlLabel = StyleSheet.flatten<TextStyle>(styles.controlLabel)
const stepperSection = StyleSheet.flatten<ViewStyle>(styles.stepperSection)
const bucketFallbackCaption = StyleSheet.flatten<TextStyle>(styles.bucketFallbackCaption)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const labelBox = (): number => resolvedNumber(controlLabel.lineHeight, "the control label's line box")

const labelInset = (): number => resolvedNumber(controlLabel.paddingTop, "the control label's top inset")

const labelBlock = (): number => labelInset() + labelBox()

const captionBox = (): number => resolvedNumber(bucketFallbackCaption.lineHeight, "the fallback caption's box")

// What Figma resolves: node 38:50 declares no line height and three painted instances of the identical style
// (49:376, 49:379 and 38:188) each hug to 32 over 8/0 padding, which fixes the box at 16.
const FIGMA_LABEL_BOX = 16
const FIGMA_LABEL_BLOCK = 36
const FIGMA_STEPPER_ORIGIN = 44

// The box React Native's platform font would invent from 13 x 1.21 with the height left unset, which is what
// the label resolved to before this fix, and the authored multi-line meta box the wrapping caption keeps.
const PLATFORM_BOX = 15.73
const AUTHORED_MULTILINE_BOX = 18.85

describe('the servings control label line box', () => {
  it('is the 16 Figma resolves for 13 px text rather than the platform font metric', () => {
    expect(labelBox()).toBe(LineHeight.LABEL)
    expect(labelBox()).toBe(FIGMA_LABEL_BOX)
    expect(labelBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('is pinned at all, so the stepper below it opens where it was drawn', () => {
    expect(controlLabel.lineHeight).toBeDefined()
  })

  it('carries the label size and semibold weight the control label is drawn at', () => {
    expect(controlLabel.fontSize).toBe(FontSize.LABEL)
    expect(controlLabel.fontWeight).toBe(FontWeight.SEMIBOLD)
  })

  it('is not the authored multi-line box, which would draw this single line 2.85 too tall', () => {
    expect(labelBox()).not.toBe(LineHeight.META)
    expect(labelBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })
})

describe('the block that box draws', () => {
  it('spends the gutter inset above the label plus the 16 box, and nothing else', () => {
    expect(labelInset()).toBe(Spacing.GUTTER)
    expect(labelBlock()).toBe(FIGMA_LABEL_BLOCK)
    expect(controlLabel.paddingBottom).toBeUndefined()
  })

  // Node 38:52's 8px gap under the label belongs to the section below it, so the stepper's own origin is the
  // label block plus that gap — which only holds while the label's box is the drawn one.
  it('puts the stepper at the label block plus the 8 px gap Figma draws under it', () => {
    expect(stepperSection.paddingTop).toBe(Spacing.X_SMALL)
    expect(labelBlock() + Spacing.X_SMALL).toBe(FIGMA_STEPPER_ORIGIN)
  })
})

describe('the fallback caption in the same sheet', () => {
  // It wraps — a bucket that could not be resolved is explained in a sentence — so the authored multi-line
  // leading is right for it. Pinned here so a sweep of the 13px styles cannot quietly take it along.
  it('keeps the authored multi-line box, which is correct for a caption that wraps', () => {
    expect(captionBox()).toBe(LineHeight.META)
    expect(captionBox()).toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
    expect(captionBox()).not.toBe(labelBox())
  })
})
