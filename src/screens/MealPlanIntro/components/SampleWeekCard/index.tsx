import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'

import BadgePill from '@components/BadgePill'
import MealIconTile from '@components/MealIconTile'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'

import {
  MEAL_PLAN_INTRO_CALORIES_PLANNED_TEXT,
  MEAL_PLAN_INTRO_GROCERY_INCLUDED_TEXT,
  MEAL_PLAN_INTRO_SAMPLE_BADGE_TEXT,
  MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_META,
  MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_NAME,
  MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_SLOT,
  MEAL_PLAN_INTRO_SAMPLE_DAY_FRIDAY,
  MEAL_PLAN_INTRO_SAMPLE_DAY_MONDAY,
  MEAL_PLAN_INTRO_SAMPLE_DAY_THURSDAY,
  MEAL_PLAN_INTRO_SAMPLE_DAY_TUESDAY,
  MEAL_PLAN_INTRO_SAMPLE_DAY_WEDNESDAY,
  MEAL_PLAN_INTRO_SAMPLE_DINNER_META,
  MEAL_PLAN_INTRO_SAMPLE_DINNER_NAME,
  MEAL_PLAN_INTRO_SAMPLE_DINNER_SLOT,
  MEAL_PLAN_INTRO_SAMPLE_LUNCH_META,
  MEAL_PLAN_INTRO_SAMPLE_LUNCH_NAME,
  MEAL_PLAN_INTRO_SAMPLE_LUNCH_SLOT,
  MEAL_PLAN_INTRO_SAMPLE_WEEK_OVERLINE
} from '@constants/strings'

import styles from './index.styled'

const SAMPLE_DAYS: {label: string; isSelected: boolean}[] = [
  {label: MEAL_PLAN_INTRO_SAMPLE_DAY_MONDAY, isSelected: true},
  {label: MEAL_PLAN_INTRO_SAMPLE_DAY_TUESDAY, isSelected: false},
  {label: MEAL_PLAN_INTRO_SAMPLE_DAY_WEDNESDAY, isSelected: false},
  {label: MEAL_PLAN_INTRO_SAMPLE_DAY_THURSDAY, isSelected: false},
  {label: MEAL_PLAN_INTRO_SAMPLE_DAY_FRIDAY, isSelected: false}
]

const SAMPLE_MEALS: {iconKey: RecipeIconKey; slot: string; name: string; meta: string}[] = [
  {
    iconKey: 'crosshair',
    slot: MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_SLOT,
    name: MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_NAME,
    meta: MEAL_PLAN_INTRO_SAMPLE_BREAKFAST_META
  },
  {
    iconKey: 'pot',
    slot: MEAL_PLAN_INTRO_SAMPLE_LUNCH_SLOT,
    name: MEAL_PLAN_INTRO_SAMPLE_LUNCH_NAME,
    meta: MEAL_PLAN_INTRO_SAMPLE_LUNCH_META
  },
  {
    iconKey: 'fork_knife',
    slot: MEAL_PLAN_INTRO_SAMPLE_DINNER_SLOT,
    name: MEAL_PLAN_INTRO_SAMPLE_DINNER_NAME,
    meta: MEAL_PLAN_INTRO_SAMPLE_DINNER_META
  }
]

const SampleWeekCard = (): React.JSX.Element => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SectionOverline text={MEAL_PLAN_INTRO_SAMPLE_WEEK_OVERLINE} />

        <BadgePill label={MEAL_PLAN_INTRO_SAMPLE_BADGE_TEXT} />
      </View>

      <View style={styles.dayStrip}>
        {SAMPLE_DAYS.map(day => (
          <View key={day.label} style={[styles.dayChip, day.isSelected && styles.dayChipSelected]}>
            <Text style={[styles.dayChipLabel, day.isSelected && styles.dayChipLabelSelected]}>{day.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.mealList}>
        {SAMPLE_MEALS.map(meal => (
          <View key={meal.slot} style={styles.mealRow}>
            <MealIconTile iconKey={meal.iconKey} />

            <View style={styles.mealTextColumn}>
              <Text style={styles.mealSlotLabel}>{meal.slot}</Text>

              <Text style={styles.mealName}>{meal.name}</Text>

              <Text style={styles.mealMeta}>{meal.meta}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <Text style={styles.footerNote}>{MEAL_PLAN_INTRO_GROCERY_INCLUDED_TEXT}</Text>

          <Text style={styles.footerTotal}>{MEAL_PLAN_INTRO_CALORIES_PLANNED_TEXT}</Text>
        </View>
      </View>
    </View>
  )
}

export default SampleWeekCard
