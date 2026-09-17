import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'

import styles from '../index.styled'
import {darkCtaMinHeight, isDarkVariant, showsPlusIcon} from '../index.util'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so each variant's box is read through `flatten`, over the same array the component
// composes. The stylesheet is asserted here rather than in a file of its own because the height contract
// is only pinned while the value `darkCtaMinHeight` returns is the value the dark box actually applies.
const defaultBox: ViewStyle = StyleSheet.flatten(styles.inner)
const darkBox: ViewStyle = StyleSheet.flatten([styles.inner, styles.innerDark])

describe('showsPlusIcon', () => {
  it('shows the plus icon for the default variant', () => {
    expect(showsPlusIcon('default')).toBe(true)
  })

  it('hides the plus icon for the dark variant', () => {
    expect(showsPlusIcon('dark')).toBe(false)
  })
})

describe('isDarkVariant', () => {
  it('applies dark styling to the dark variant', () => {
    expect(isDarkVariant('dark')).toBe(true)
  })

  it('does not apply dark styling to the default variant', () => {
    expect(isDarkVariant('default')).toBe(false)
  })
})

describe('darkCtaMinHeight', () => {
  it('pins the dark box at the height Figma authors for the secondary CTA', () => {
    expect(darkCtaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET)).toBe(Sizes.CTA)
  })

  it('raises an authored height that would fall under the touch-target floor', () => {
    expect(darkCtaMinHeight(Sizes.CONTROL_SM, Sizes.TOUCH_TARGET)).toBe(Sizes.TOUCH_TARGET)
  })

  it('returns the shared value when the authored height is the floor', () => {
    expect(darkCtaMinHeight(Sizes.TOUCH_TARGET, Sizes.TOUCH_TARGET)).toBe(Sizes.TOUCH_TARGET)
  })
})

describe('the dark CTA box', () => {
  it('applies the pinned height rather than deriving one from its content', () => {
    expect(darkBox.minHeight).toBe(darkCtaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET))
    expect(darkBox.minHeight).toBe(Sizes.CTA)
  })

  it('is never shorter than the 44px touch target', () => {
    expect(darkBox.minHeight).toBeGreaterThanOrEqual(Sizes.TOUCH_TARGET)
  })

  it('centres its label on both axes, so the label stays centred as the box grows past its content', () => {
    expect(darkBox.alignItems).toBe('center')
    expect(darkBox.justifyContent).toBe('center')
  })
})

describe('the default variant box', () => {
  it('keeps the shipped plus affordance content-derived, with no CTA height pinned to it', () => {
    expect(defaultBox.minHeight).toBeUndefined()
  })
})
