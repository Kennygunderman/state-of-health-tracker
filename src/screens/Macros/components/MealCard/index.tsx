import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Meal} from '@data/models/Meal'
import {MealEntry} from '@data/models/MealEntry'
import {AntDesign} from '@expo/vector-icons'
import {Theme} from '@styles/theme'
import {Swipeable} from 'react-native-gesture-handler'

import Text from '@components/Text'

import {
  CAL_LABEL,
  EMPTY_MEAL_CTA,
  MEAL_CARD_ADD_FOOD_ACCESSIBILITY_TEMPLATE,
  MEAL_CARD_EMPTY_CTA_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import MealEntryRow from '../MealEntryRow'
import styles from './index.styled'

const ADD_ICON_SIZE = 14

interface Props {
  meal: Meal
  onAddFoodPressed: () => void
  onEntryPressed: (entry: MealEntry) => void
  onDeleteEntryPressed: (entryId: string) => void
  swipeableRef: (ref: Swipeable, index: number) => void
  onSwipeActivated: (index: number) => void
}

const MealCard = (props: Props) => {
  const {meal, onAddFoodPressed, onEntryPressed, onDeleteEntryPressed, swipeableRef, onSwipeActivated} = props

  const hasEntries = meal.entries.length > 0

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {meal.name}
          </Text>

          {hasEntries && <Text style={styles.headerCalories}>{`${meal.totals.calories} ${CAL_LABEL}`}</Text>}
        </View>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_CARD_ADD_FOOD_ACCESSIBILITY_TEMPLATE, {
            meal: meal.name
          })}
          onPress={onAddFoodPressed}>
          <AntDesign name="plus" size={ADD_ICON_SIZE} color={Theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {meal.entries.map((entry, index) => (
        <View key={entry.id}>
          <View style={styles.divider} />

          <MealEntryRow
            entry={entry}
            onPress={() => onEntryPressed(entry)}
            onDeletePressed={() => onDeleteEntryPressed(entry.id)}
            swipeableRef={ref => swipeableRef(ref, index)}
            onSwipeActivated={() => onSwipeActivated(index)}
          />
        </View>
      ))}

      {!hasEntries && (
        <TouchableOpacity
          style={styles.emptyCta}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_CARD_EMPTY_CTA_ACCESSIBILITY_TEMPLATE, {
            cta: EMPTY_MEAL_CTA,
            meal: meal.name
          })}
          onPress={onAddFoodPressed}>
          <Text style={styles.emptyCtaText}>{EMPTY_MEAL_CTA}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default MealCard
