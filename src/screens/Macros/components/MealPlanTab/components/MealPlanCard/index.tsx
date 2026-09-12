import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {MealPlanMeal} from '@data/models/MealPlan'
import {Opacity, Sizes} from '@styles/sizes'
import {formatSlotTime} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'

import MealIconTile from '@components/MealIconTile'
import Text from '@components/Text'

import {
  MEAL_PLAN_LOG_MEAL_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_LOG_MEAL_BUTTON_TEXT,
  MEAL_PLAN_LOGGED_PREVIOUS_RECIPE_TEMPLATE,
  MEAL_PLAN_MEAL_CALORIES_TEMPLATE,
  MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR,
  MEAL_PLAN_MEAL_FLAG_TEMPLATES,
  MEAL_PLAN_MEAL_META_LOGGED_TEMPLATE,
  MEAL_PLAN_MEAL_META_TEMPLATE,
  MEAL_PLAN_MEAL_SLOT_TIME_TEMPLATE,
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SWAP_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SWAP_BUTTON_TEXT,
  MEAL_PLAN_VIEW_IN_DIARY_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_VIEW_IN_DIARY_BUTTON_TEXT,
  MEAL_SLOT_LABELS,
  stringWithNamedParameters
} from '@constants/strings'

import {MealLoggedState, resolveMealFlagReason} from '../../index.util'
import LoggedBadge from '../LoggedBadge'
import styles from './index.styled'

const ACTION_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

const IS_LOGGED_BY_STATE: Record<MealLoggedState['kind'], boolean> = {
  unlogged: false,
  logged: true,
  loggedThenSwapped: false
}

interface Props {
  meal: MealPlanMeal
  loggedState: MealLoggedState
  onOpen: () => void
  onSwap: () => void
  onLog: () => void
  onViewDiary: () => void
}

const MealPlanCard = ({meal, loggedState, onOpen, onSwap, onLog, onViewDiary}: Props): React.JSX.Element => {
  const isLogged = IS_LOGGED_BY_STATE[loggedState.kind]
  const previousEntry = loggedState.kind === 'loggedThenSwapped' ? loggedState.entry : null
  const flagReason = resolveMealFlagReason(meal.flags)

  // Figma draws no flagged card: a meal the user's edited preferences no longer allow keeps its drawn structure
  // and gains this line, so the reason is stated where the meal is rather than only in the settings banner.
  const flagText =
    flagReason === null
      ? null
      : stringWithNamedParameters(MEAL_PLAN_MEAL_FLAG_TEMPLATES[flagReason], {
          detail: meal.flags.flatMap(flag => flag.detail).join(MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR)
        })
  const metaText = stringWithNamedParameters(MEAL_PLAN_MEAL_SLOT_TIME_TEMPLATE, {
    slot: MEAL_SLOT_LABELS[meal.slot],
    time: formatSlotTime(meal.slotTime)
  })
  const caloriesText = stringWithNamedParameters(MEAL_PLAN_MEAL_CALORIES_TEMPLATE, {
    calories: formatCalories(meal.planned.calories)
  })
  const recipeMetaText = isLogged
    ? stringWithNamedParameters(MEAL_PLAN_MEAL_META_LOGGED_TEMPLATE, {
        portion: meal.portionText,
        protein: formatMacroGrams(meal.planned.protein)
      })
    : stringWithNamedParameters(MEAL_PLAN_MEAL_META_TEMPLATE, {
        portion: meal.portionText,
        minutes: meal.recipe.totalMinutes,
        protein: formatMacroGrams(meal.planned.protein)
      })
  const primaryLabel = isLogged ? MEAL_PLAN_VIEW_IN_DIARY_BUTTON_TEXT : MEAL_PLAN_LOG_MEAL_BUTTON_TEXT
  const primaryAccessibilityLabel = stringWithNamedParameters(
    isLogged ? MEAL_PLAN_VIEW_IN_DIARY_ACCESSIBILITY_TEMPLATE : MEAL_PLAN_LOG_MEAL_ACCESSIBILITY_TEMPLATE,
    {recipe: meal.recipe.name}
  )

  return (
    <TouchableOpacity
      style={[styles.card, flagText !== null && styles.cardFlagged]}
      activeOpacity={Opacity.PRESSED}
      accessibilityRole="button"
      accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {
        recipe: meal.recipe.name
      })}
      onPress={onOpen}>
      <View style={styles.metaRow}>
        <View style={styles.metaLeftGroup}>
          <Text style={styles.metaText}>{metaText}</Text>

          {isLogged && <LoggedBadge />}
        </View>

        <Text style={styles.metaCalories}>{caloriesText}</Text>
      </View>

      <View style={styles.contentRow}>
        <View style={[isLogged && styles.tileMuted]}>
          <MealIconTile iconKey={meal.recipe.iconKey} />
        </View>

        <View style={styles.textColumn}>
          <Text style={[styles.recipeName, isLogged && styles.recipeNameLogged]}>{meal.recipe.name}</Text>

          <Text style={styles.recipeMeta}>{recipeMetaText}</Text>

          {flagText !== null && <Text style={styles.flagText}>{flagText}</Text>}

          {/* Figma draws no swapped-after-logging card: the replacement is never presented as logged, so it
              renders unlogged and this caption names the meal that went to the diary, where it is untouched. */}
          {previousEntry !== null && (
            <View style={styles.swappedRow}>
              <Text style={styles.swappedCaption}>
                {stringWithNamedParameters(MEAL_PLAN_LOGGED_PREVIOUS_RECIPE_TEMPLATE, {
                  recipe: previousEntry.recipeName
                })}
              </Text>

              <Text
                style={styles.swappedLink}
                accessibilityRole="button"
                accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_VIEW_IN_DIARY_ACCESSIBILITY_TEMPLATE, {
                  recipe: previousEntry.recipeName
                })}
                onPress={onViewDiary}>
                {MEAL_PLAN_VIEW_IN_DIARY_BUTTON_TEXT}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.pillSecondary}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_SWAP_ACCESSIBILITY_TEMPLATE, {
            recipe: meal.recipe.name
          })}
          hitSlop={ACTION_PILL_HIT_SLOP}
          onPress={onSwap}>
          <Text style={styles.pillLabelSecondary}>{MEAL_PLAN_SWAP_BUTTON_TEXT}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pillPrimary}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={primaryAccessibilityLabel}
          hitSlop={ACTION_PILL_HIT_SLOP}
          onPress={isLogged ? onViewDiary : onLog}>
          <Text style={styles.pillLabelPrimary}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default MealPlanCard
