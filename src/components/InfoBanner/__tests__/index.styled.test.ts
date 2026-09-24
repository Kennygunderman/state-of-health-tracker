import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// `hitSlop` never extends past the parent view's bounds, so the banner's error actions cannot be slopped 32 pt
// pills: the row ends at the pill's bottom edge and clipped the lower half of the slop away, leaving a 38 pt
// target against the 44 pt minimum. The pressable is a real Sizes.TOUCH_TARGET envelope instead, and what this
// file pins is that the change bought the target without moving the paint — the drawn gaps above and below the
// pill are still the Spacing.SMALL the shell is authored with (0.2.3), half from the row or the banner and half
// from the envelope's own inset.
const container: ViewStyle = StyleSheet.flatten(styles.container)
const containerActionRow: ViewStyle = StyleSheet.flatten(styles.containerActionRow)
const actionRow: ViewStyle = StyleSheet.flatten(styles.actionRow)
const actionEnvelope: ViewStyle = StyleSheet.flatten(styles.actionEnvelope)
const primaryAction: ViewStyle = StyleSheet.flatten(styles.primaryAction)
const secondaryAction: ViewStyle = StyleSheet.flatten(styles.secondaryAction)
const primaryActionLabel: TextStyle = StyleSheet.flatten(styles.primaryActionLabel)
const secondaryActionLabel: TextStyle = StyleSheet.flatten(styles.secondaryActionLabel)

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a percentage
// string — has to fail the test loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// The pill's own box: its padding plus the line box its label occupies. Neither label pins a line height, so
// that box is the one the design resolves for a single-line 13 px label — what LineHeight.LABEL names (see the
// note on that token). The padding is read out of the style rather than restated, so a change to it fails here
// instead of silently resizing the pill.
const paintedPillHeight = (pill: ViewStyle, label: TextStyle, description: string): number => {
  if (label.lineHeight !== undefined) {
    throw new Error(`Expected ${description}'s label to leave its line height to the base text size`)
  }

  return resolvedNumber(pill.paddingVertical, `${description}'s vertical padding`) * 2 + LineHeight.LABEL
}

// A Sizes.PILL_SM pill centred in a Sizes.TOUCH_TARGET envelope leaves half the difference transparent above
// it and half below. That is the space the row and the banner give up so the paint does not move.
const ENVELOPE_INSET_V = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

describe('the error action pressable envelope', () => {
  it('is a full Sizes.TOUCH_TARGET tall, so nothing is left to hitSlop to extend', () => {
    expect(resolvedNumber(actionEnvelope.minHeight, "the envelope's minimum height")).toBe(Sizes.TOUCH_TARGET)
  })

  it('centres the pill it holds, so the envelope grows symmetrically around the paint', () => {
    expect(actionEnvelope.justifyContent).toBe('center')
    expect(actionEnvelope.height).toBeUndefined()
    expect(actionEnvelope.maxHeight).toBeUndefined()
  })

  it('carries the shrink that used to sit on the pills, so a long label still narrows the pressable', () => {
    expect(actionEnvelope.flexShrink).toBe(1)
    expect(primaryAction.flexShrink).toBeUndefined()
    expect(secondaryAction.flexShrink).toBeUndefined()
  })

  it('paints nothing of its own: the pill inside it draws the fill, radius and padding', () => {
    expect(actionEnvelope.backgroundColor).toBeUndefined()
    expect(actionEnvelope.borderRadius).toBeUndefined()
    expect(actionEnvelope.paddingVertical).toBeUndefined()
    expect(actionEnvelope.paddingHorizontal).toBeUndefined()
  })
})

describe('the painted pills inside it', () => {
  it('still resolve to Sizes.PILL_SM at the base text size, both tones', () => {
    expect(paintedPillHeight(primaryAction, primaryActionLabel, 'the primary pill')).toBe(Sizes.PILL_SM)
    expect(paintedPillHeight(secondaryAction, secondaryActionLabel, 'the secondary pill')).toBe(Sizes.PILL_SM)
  })

  it('keep the horizontal padding the Figma pills are drawn with', () => {
    expect(primaryAction.paddingHorizontal).toBe(Spacing.SMALL)
    expect(secondaryAction.paddingHorizontal).toBe(Spacing.SMALL)
  })
})

describe('the space the envelope introduces', () => {
  it('halves the row padding above, so the drawn gap over the pill is still Spacing.SMALL', () => {
    const paddingTop = resolvedNumber(actionRow.paddingTop, "the action row's top padding")

    expect(paddingTop).toBe(Spacing.TIGHT)
    expect(paddingTop + ENVELOPE_INSET_V).toBe(Spacing.SMALL)
  })

  it('halves the banner padding below, so the drawn gap under the pill is still Spacing.SMALL', () => {
    const paddingBottom = resolvedNumber(containerActionRow.paddingBottom, "the action-row banner's bottom padding")

    expect(paddingBottom).toBe(Spacing.TIGHT)
    expect(paddingBottom + ENVELOPE_INSET_V).toBe(Spacing.SMALL)
  })

  it('reaches the 44 pt target out of the pill and the inset the two halves pay for', () => {
    expect(Sizes.PILL_SM + ENVELOPE_INSET_V * 2).toBe(Sizes.TOUCH_TARGET)
    expect(ENVELOPE_INSET_V).toBe(Spacing.TIGHT)
  })

  it('is charged only where the action row is drawn — a banner without one keeps its shell padding', () => {
    expect(container.paddingVertical).toBe(Spacing.SMALL)
    expect(container.paddingBottom).toBeUndefined()
    expect(containerActionRow.paddingTop).toBeUndefined()
    expect(containerActionRow.paddingVertical).toBeUndefined()
  })

  it('leaves the row spacing between the actions themselves alone', () => {
    expect(actionRow.columnGap).toBe(Spacing.X_SMALL)
    expect(actionRow.rowGap).toBe(Spacing.X_SMALL)
  })
})
