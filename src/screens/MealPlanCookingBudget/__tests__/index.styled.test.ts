import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles, {NO_BUDGET_ROW_HIT_SLOP} from '../index.styled'

// Frame 08 draws the two rows this file covers at 40px (the cooking chip row, `47:619`) and 34px (the no-budget
// checkbox row, `47:646` — a 12px rung over a 22px box, with zero slack). A row grown to the 44px touch minimum
// renders both taller than drawn and drifts everything below them, so what is pinned here is that each row's
// height is still derived from its own composition and that the checkbox row reaches 44 through hit slop whose
// edge is arithmetic on that composition rather than a chosen inset.
const cookingChips: ViewStyle = StyleSheet.flatten(styles.cookingChips)
const preferenceRow: ViewStyle = StyleSheet.flatten(styles.preferenceRow)

// Guarded rather than cast: a style value that stops being a number has to fail loudly instead of being scored
// as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

describe('the cooking-time chip row', () => {
  it('declares no height, so the row is its own rung over the chips the band draws', () => {
    expect(cookingChips.height).toBeUndefined()
    expect(cookingChips.minHeight).toBeUndefined()
    expect(cookingChips.maxHeight).toBeUndefined()
  })

  it('measures the 40px 47:619 draws: the rung it owns over one Sizes.CHIP band', () => {
    const paddingTop = resolvedNumber(cookingChips.paddingTop, "the chip row's rung")

    expect(paddingTop).toBe(Spacing.X_SMALL)
    expect(paddingTop + Sizes.CHIP).toBe(40)
  })
})

describe('the no-budget checkbox row', () => {
  it('declares no height, so the row hugs the checkbox as 47:646 draws it', () => {
    expect(preferenceRow.height).toBeUndefined()
    expect(preferenceRow.minHeight).toBeUndefined()
    expect(preferenceRow.maxHeight).toBeUndefined()
  })

  it('measures the 34px 47:646 draws: its rung over CheckboxSquare, with zero slack', () => {
    const paddingTop = resolvedNumber(preferenceRow.paddingTop, "the checkbox row's rung")

    expect(paddingTop).toBe(Spacing.SMALL)
    expect(paddingTop + Sizes.ICON_LG).toBe(34)
  })
})

describe('the touch target the checkbox row reaches without growing', () => {
  it('extends the row to exactly Sizes.TOUCH_TARGET, never past it', () => {
    const bottom = resolvedNumber(NO_BUDGET_ROW_HIT_SLOP.bottom, "the row's lower slop")
    const paddingTop = resolvedNumber(preferenceRow.paddingTop, "the checkbox row's rung")

    expect(bottom + paddingTop + Sizes.ICON_LG).toBe(Sizes.TOUCH_TARGET)
  })

  it('takes none of it upward, so the 48px budget field above keeps its own target', () => {
    expect(NO_BUDGET_ROW_HIT_SLOP.top).toBe(0)
  })

  it('stays inside the footnote rung beneath it, which takes no touches', () => {
    const bottom = resolvedNumber(NO_BUDGET_ROW_HIT_SLOP.bottom, "the row's lower slop")
    const helperRung = resolvedNumber(StyleSheet.flatten(styles.helperText).paddingTop, "the footnote's rung")

    expect(bottom).toBeLessThanOrEqual(helperRung + Spacing.X_SMALL)
  })
})
