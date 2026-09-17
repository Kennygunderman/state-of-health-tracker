import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {CatalogFood} from '@data/models/CatalogFood'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {lookupLabel} from '@utility/TextUtility'
import Svg, {Path} from 'react-native-svg'

import Text from '@components/Text'

import {
  CATALOG_CATEGORY_LABELS,
  MEAL_PLAN_ADD_FOOD_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import styles, {ROW_HIT_SLOP} from './index.styled'

interface Props {
  food: CatalogFood
  isAdded: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: (id: string) => void
}

// The list re-renders on every keystroke, so a row that is handed the same food and the same reader does not
// re-render with it; taking the id back through onToggle is what lets the reader stay the same one.
const FoodSearchResultRow = React.memo(({food, isAdded, isFirst, isLast, onToggle}: Props): React.JSX.Element => {
  const rowStyle = [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast]
  const rowContentStyle = [styles.rowContent, !isFirst && styles.rowContentDivider]
  const nameStyle = [styles.name, isAdded && styles.nameAdded]

  const categoryLabel = lookupLabel(CATALOG_CATEGORY_LABELS, food.category)

  const accessibilityLabel = stringWithNamedParameters(
    isAdded ? MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE : MEAL_PLAN_ADD_FOOD_ACCESSIBILITY_TEMPLATE,
    {name: food.name}
  )

  const onPress = (): void => onToggle(food.id)

  return (
    <TouchableOpacity
      style={rowStyle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected: isAdded}}
      hitSlop={ROW_HIT_SLOP}
      activeOpacity={Opacity.PRESSED}
      onPress={onPress}>
      <View style={rowContentStyle}>
        <View style={styles.textColumn}>
          <Text style={nameStyle}>{food.name}</Text>

          {!!categoryLabel && <Text style={styles.category}>{categoryLabel}</Text>}
        </View>

        {isAdded ? (
          <View style={styles.addedControl}>
            {/* BLITZY [A11Y]: this white check over the accent-green `addedControl` surface is Figma `47:388`
                over `47:387` and measures 2.45:1, below the 3:1 non-text minimum. Upheld exactly and flagged
                at `addedControl` in this folder's stylesheet, which records the remedies; the coordinated
                decision covering every control sharing this pair is in the register in `@styles/theme`. */}
            <Svg width={Sizes.ICON_LG} height={Sizes.ICON_LG} viewBox="0 0 22 22" fill="none">
              <Path
                d="M7.111 10.354L9.939 13.182L14.889 8.232"
                stroke={Theme.colors.white}
                strokeWidth={Stroke.BOLD}
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
            </Svg>
          </View>
        ) : (
          <View style={styles.addControl}>
            {/* Drawn rather than typeset: 47:399 sets the plus as 17px text, which at the larger
                accessibility text sizes outgrows the 28px disc holding it, and a glyph cannot be clipped
                into shape. The tick beside it is already vector, so this keeps the two states symmetric. */}
            <Svg width={Sizes.ICON_SM} height={Sizes.ICON_SM} viewBox="0 0 17 17" fill="none">
              <Path
                d="M3.5 8.5H13.5M8.5 3.5V13.5"
                stroke={Theme.colors.textSecondary}
                strokeWidth={Stroke.DEFAULT}
                strokeLinecap="butt"
              />
            </Svg>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
})

FoodSearchResultRow.displayName = 'FoodSearchResultRow'

export default FoodSearchResultRow
