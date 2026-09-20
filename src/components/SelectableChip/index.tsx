import React from 'react'

import {TouchableOpacity} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'

import Text from '@components/Text'

import {
  MEAL_PLAN_CHIP_REMOVE_GLYPH,
  MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import styles from './index.styled'

/* BLITZY [A11Y]: Figma draws the pill 32px tall (`47:178`/`47:187`, `Sizes.CHIP`) and specifies no hit area at
   all, so the 44px minimum AAP 0.7.2 asks of chips and pills is reached through hit slop — 32 + 2 x 6 = 44 —
   and never by growing the pill or wrapping it in a taller pressable. A taller pressable would render every
   chip row 44px instead of the 40px Figma draws for it (`47:177`, `47:287`, `47:303`, `47:431`, `47:619`), and
   Figma outranks the 44px default (AAP 0.6.5): the drawn geometry is matched and the shortfall is carried by
   slop, exactly as @screens/MealPlanTargets/components/PlanStartsCard carries it for its own 32px pill.
   Slop is clipped to the bounds of the view that holds the chip, so each band reserves room for it with
   vertical padding and hands the reserved height straight back to the layout with an equal negative margin
   (@components/ChipCloud/index.styled and the 06b band's own stylesheet). That is what makes the 44 real
   inside a band that scrolls and clips, and it leaves the drawn geometry untouched. Because the negative
   margin places the reserved strip outside the band's own layout box, a screen wrapping the band in a view
   that hugs it also carries the matching slop, so the strip stays reachable on Android too. One residual,
   flagged for designer review rather than engineered away: the 06b selected band is wrapped by a view this
   unit does not own, so its lower 6px is not reachable on Android — the band's chips are reachable
   everywhere else, and the row is never the only way to remove a selection (06b's result rows toggle the
   same state). */
const CHIP_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.CHIP) / 2

interface Props {
  label: string
  selected: boolean
  removable?: boolean
  onPress: () => void
}

const SelectableChip = ({label, selected, removable = false, onPress}: Props): React.JSX.Element => {
  const isRemovable = removable && selected
  const removeHint = isRemovable
    ? stringWithNamedParameters(MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE, {name: label})
    : undefined

  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.containerSelected]}
      activeOpacity={Opacity.PRESSED}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={removeHint}
      accessibilityState={{selected}}
      onPress={onPress}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>

      {isRemovable && <Text style={styles.removeGlyph}>{MEAL_PLAN_CHIP_REMOVE_GLYPH}</Text>}
    </TouchableOpacity>
  )
}

export default SelectableChip
