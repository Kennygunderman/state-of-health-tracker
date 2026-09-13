import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'

import Text from '@components/Text'

import {
  MEAL_PLAN_CHIP_REMOVE_GLYPH,
  MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import styles from './index.styled'

/* BLITZY [A11Y]: Figma draws the pill 32px tall (`47:178`/`47:187`, `Sizes.CHIP`) and specifies no hit area at
   all, so the 44px minimum AAP 0.7.2 requires of chips and pills is met through the pressable rather than by
   resizing the pill. Hit slop alone cannot do it everywhere: React Native never delivers a touch outside an
   ancestor's bounds (`ViewPropTypes.d.ts` hitSlop note; `RCTScrollViewComponentView` rejects points outside a
   band that does not overflow), so a parent that hugs the pill clips the slop away. `expandTouchTarget` gives
   the chip its own `Sizes.TOUCH_TARGET` pressable with the pill unchanged inside it, and a row that opts in
   renders 44px tall instead of the 40px Figma draws for it (`47:431`) — the one rendered deviation, flagged
   here for designer review. Chips that do not opt in keep the slop below, 32 + 2 x 6 = 44, honoured as far as
   their parent's own bounds. */
const CHIP_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.CHIP) / 2

interface Props {
  label: string
  selected: boolean
  removable?: boolean
  expandTouchTarget?: boolean
  onPress: () => void
}

const SelectableChip = ({label, selected, removable = false, expandTouchTarget = false, onPress}: Props) => {
  const isRemovable = removable && selected
  const removeHint = isRemovable
    ? stringWithNamedParameters(MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE, {name: label})
    : undefined
  const pillStyle = [styles.container, selected && styles.containerSelected]

  const content = (
    <>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>

      {isRemovable && <Text style={styles.removeGlyph}>{MEAL_PLAN_CHIP_REMOVE_GLYPH}</Text>}
    </>
  )

  return (
    <TouchableOpacity
      style={expandTouchTarget ? styles.touchHost : pillStyle}
      activeOpacity={Opacity.PRESSED}
      hitSlop={expandTouchTarget ? undefined : CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={removeHint}
      accessibilityState={{selected}}
      onPress={onPress}>
      {expandTouchTarget ? <View style={pillStyle}>{content}</View> : content}
    </TouchableOpacity>
  )
}

export default SelectableChip
