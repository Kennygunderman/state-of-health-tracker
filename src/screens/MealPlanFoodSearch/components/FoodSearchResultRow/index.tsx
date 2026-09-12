import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {CatalogFood} from '@data/models/CatalogFood'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import Svg, {Path} from 'react-native-svg'

import Text from '@components/Text'

import {
  CATALOG_CATEGORY_LABELS,
  MEAL_PLAN_ADD_FOOD_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SEARCH_ADD_GLYPH,
  stringWithNamedParameters
} from '@constants/strings'

import styles, {ROW_HIT_SLOP} from './index.styled'

interface Props {
  food: CatalogFood
  isAdded: boolean
  isFirst: boolean
  isLast: boolean
  onPress: () => void
}

const FoodSearchResultRow = ({food, isAdded, isFirst, isLast, onPress}: Props) => {
  const rowStyle = [styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast]
  const rowContentStyle = [styles.rowContent, !isFirst && styles.rowContentDivider]
  const nameStyle = [styles.name, isAdded && styles.nameAdded]

  const categoryLabel = CATALOG_CATEGORY_LABELS[food.category]

  const accessibilityLabel = stringWithNamedParameters(
    isAdded ? MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE : MEAL_PLAN_ADD_FOOD_ACCESSIBILITY_TEMPLATE,
    {name: food.name}
  )

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
            <Text style={styles.addGlyph}>{MEAL_PLAN_SEARCH_ADD_GLYPH}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default FoodSearchResultRow
