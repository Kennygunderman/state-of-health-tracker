import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'

import optionCardStyles from '@components/OptionCard/index.styled'

import styles, {INDICATOR_SIZE, LABEL_LINE_BOX, SUBCOPY_LINE_BOX} from '../index.styled'
import {OptionCardSkeletonSubcopyLines} from '../index.util'

// This placeholder has one requirement that nothing it renders can state on its own: it must occupy the
// height of the card it stands for, or the content below it moves when the saved answer lands. Its height is
// not a value it holds — it is the sum of the box model it shares with OptionCard and the line boxes of the
// text it replaces — so the requirement is asserted here, against OptionCard's own stylesheet, which is also
// what makes a later change to that card's padding or line boxes fail here rather than on a device.
const skeletonCard = StyleSheet.flatten<ViewStyle>(styles.card)
const skeletonTextColumn = StyleSheet.flatten<ViewStyle>(styles.textColumn)
const skeletonLabelLine = StyleSheet.flatten<ViewStyle>(styles.labelLine)
const skeletonSubcopyLine = StyleSheet.flatten<ViewStyle>(styles.subcopyLine)
const loadedCard = StyleSheet.flatten<ViewStyle>(optionCardStyles.card)
const loadedTextColumn = StyleSheet.flatten<ViewStyle>(optionCardStyles.textColumn)
const loadedIndicator = StyleSheet.flatten<ViewStyle>(optionCardStyles.indicator)
const loadedSubcopy = StyleSheet.flatten<TextStyle>(optionCardStyles.subcopy)
const loadedLabel = StyleSheet.flatten<TextStyle>(optionCardStyles.label)

// The widest a line box may sit above its font size before it is reserving space no line occupies. Platform
// system faces resolve a 16px line to roughly 1.19 of it, and the design system's own authored line boxes run
// to 1.45, so a ratio above this is a token standing in for the wrong thing.
const MAX_LINE_BOX_RATIO = 1.5

// Guarded rather than cast, and read inside the tests: a style value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than being
// scored as `undefined` or crashing the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// Border and vertical padding: the part of a card's height that its content does not decide.
const chromeHeight = (card: ViewStyle, description: string): number =>
  2 * resolvedNumber(card.borderWidth, `${description} border width`) +
  2 * resolvedNumber(card.paddingVertical, `${description} vertical padding`)

// What the row's centred content measures: the indicator, or the text column where the text is taller.
const cardHeight = (lines: OptionCardSkeletonSubcopyLines): number => {
  const column =
    resolvedNumber(skeletonLabelLine.height, 'the label line box') +
    (lines === 0
      ? 0
      : resolvedNumber(skeletonTextColumn.gap, "the text column's gap") +
        lines * resolvedNumber(skeletonSubcopyLine.height, 'a sub-copy line box'))

  return chromeHeight(skeletonCard, 'the placeholder card') + Math.max(INDICATOR_SIZE, column)
}

// The heights the setup flow renders today, measured off the loaded cards: 48 for a card with a label alone
// (the diet step), 65 for a label with one sub-copy line and 83 where that sub-copy wraps to two (the
// activity step, whose four cards measure 65/83/65/65 at the reference width). A placeholder within a pixel
// of these moves nothing perceptible when the answer arrives; the four uniform 48px blocks this component
// replaces were ~85px short across the group.
const MEASURED_LABEL_ONLY_HEIGHT = 48
const MEASURED_ONE_SUBCOPY_HEIGHT = 65
const MEASURED_TWO_SUBCOPY_HEIGHT = 83

// The label is the one line box neither card pins: OptionCard sets no `lineHeight` on it, so React Native
// measures it from the platform font (~19.1 at 16px) and the placeholder stands in the nearest authored line
// box for it. A pixel is what that substitution is allowed to cost.
const HEIGHT_TOLERANCE = 1

describe('the placeholder card and the card it stands for', () => {
  it('shares the box model that decides the part of a card height its content does not', () => {
    expect(chromeHeight(skeletonCard, 'the placeholder card')).toBe(chromeHeight(loadedCard, 'the option card'))
  })

  it('lays its row out the same way, so the same content produces the same height', () => {
    expect(skeletonCard.flexDirection).toBe(loadedCard.flexDirection)
    expect(skeletonCard.alignItems).toBe(loadedCard.alignItems)
    expect(skeletonCard.alignSelf).toBe(loadedCard.alignSelf)
    expect(skeletonCard.gap).toBe(loadedCard.gap)
  })

  it('carries the card radius, so the placeholder reads as the card rather than as a bar', () => {
    expect(skeletonCard.borderRadius).toBe(loadedCard.borderRadius)
  })

  it('stands a disc the size of the indicator that sets a label-only card height', () => {
    expect(INDICATOR_SIZE).toBe(resolvedNumber(loadedIndicator.height, "the option card indicator's height"))
  })

  it('separates the label from its sub-copy by the gap the card uses', () => {
    expect(skeletonTextColumn.gap).toBe(loadedTextColumn.gap)
  })

  it('reserves the sub-copy line box the card pins rather than one of its own', () => {
    expect(SUBCOPY_LINE_BOX).toBe(resolvedNumber(loadedSubcopy.lineHeight, "the option card sub-copy's line box"))
  })

  // The one line box OptionCard does not pin, so the placeholder stands in the nearest authored one: it has
  // to be at least the label's own size and no more than a line box for it, or the card grows around a bar
  // that is standing for nothing.
  it('reserves a label line box that could hold the label it replaces', () => {
    const labelSize = resolvedNumber(loadedLabel.fontSize, "the option card label's size")

    expect(LABEL_LINE_BOX).toBeGreaterThanOrEqual(labelSize)
    expect(LABEL_LINE_BOX).toBeLessThanOrEqual(labelSize * MAX_LINE_BOX_RATIO)
  })
})

describe('the height a placeholder card occupies', () => {
  it('is the height of a card carrying a label alone', () => {
    expect(Math.abs(cardHeight(0) - MEASURED_LABEL_ONLY_HEIGHT)).toBeLessThanOrEqual(HEIGHT_TOLERANCE)
  })

  it('is the height of a card carrying one line of sub-copy', () => {
    expect(Math.abs(cardHeight(1) - MEASURED_ONE_SUBCOPY_HEIGHT)).toBeLessThanOrEqual(HEIGHT_TOLERANCE)
  })

  it('is the height of a card whose sub-copy wraps to two lines', () => {
    expect(Math.abs(cardHeight(2) - MEASURED_TWO_SUBCOPY_HEIGHT)).toBeLessThanOrEqual(HEIGHT_TOLERANCE)
  })

  it('grows with each sub-copy line rather than standing one height for every card', () => {
    expect(cardHeight(1)).toBeGreaterThan(cardHeight(0))
    expect(cardHeight(2)).toBeGreaterThan(cardHeight(1))
  })

  // The state this component replaces: one control-sized block per card, whatever the card held. It stood
  // ~17px short of a card with sub-copy and ~35px short of one that wrapped, which is the content shift the
  // group showed when the saved answer arrived.
  it('is no longer the control-sized block a card with sub-copy was given', () => {
    expect(cardHeight(1)).toBeGreaterThan(Sizes.CONTROL_LG)
    expect(cardHeight(2)).toBeGreaterThan(Sizes.CONTROL_LG)
  })

  it('still matches the control height where a card carries a label alone, which is what that block fitted', () => {
    expect(cardHeight(0)).toBe(Sizes.CONTROL_LG)
  })
})
