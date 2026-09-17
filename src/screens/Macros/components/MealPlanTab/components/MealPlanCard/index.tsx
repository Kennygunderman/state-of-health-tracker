import React, {useCallback} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {LoggedPlannedEntry, MealPlanMeal} from '@data/models/MealPlan'
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
  // Whether this day's plan currently accepts writes. The controls are still drawn and still pressable when it
  // is false, so a refusal the caller can explain is not swallowed by a disabled button.
  areWriteActionsEnabled: boolean
  onOpen: (meal: MealPlanMeal) => void
  onSwap: (meal: MealPlanMeal) => void
  onLog: (meal: MealPlanMeal) => void
  onViewEntry: (entry: LoggedPlannedEntry) => void
}

const MealPlanCard = ({
  meal,
  loggedState,
  areWriteActionsEnabled,
  onOpen,
  onSwap,
  onLog,
  onViewEntry
}: Props): React.JSX.Element => {
  const isLogged = IS_LOGGED_BY_STATE[loggedState.kind]
  const previousEntry = loggedState.kind === 'loggedThenSwapped' ? loggedState.entry : null
  const loggedEntry = loggedState.kind === 'unlogged' ? null : loggedState.entry
  const flagReason = resolveMealFlagReason(meal.flags)
  // "View in diary" is a read of an entry that already exists, so it stays available while the plan does not
  // accept writes; only Swap and Log follow the verdict.
  const isPrimaryWrite = !isLogged
  const isSwapDimmed = !areWriteActionsEnabled
  const isPrimaryDimmed = isPrimaryWrite && !areWriteActionsEnabled

  const onOpenPressed = useCallback((): void => onOpen(meal), [meal, onOpen])

  const onSwapPressed = useCallback((): void => onSwap(meal), [meal, onSwap])

  const onLogPressed = useCallback((): void => onLog(meal), [meal, onLog])

  const onViewEntryPressed = useCallback((): void => {
    if (loggedEntry !== null) {
      onViewEntry(loggedEntry)
    }
  }, [loggedEntry, onViewEntry])

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

  // The card itself carries no role and no press: only the meta and content rows open the recipe, so the Swap,
  // primary and diary-link controls stay separate accessibility elements instead of collapsing into one button.
  // That is also why the swapped caption sits outside the open-recipe region — its link is itself a pressable —
  // and why the content row goes flush there: the caption row then carries the card's bottom gap.
  return (
    <View style={[styles.card, flagText !== null && styles.cardFlagged]}>
      <TouchableOpacity
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {
          recipe: meal.recipe.name
        })}
        onPress={onOpenPressed}>
        <View style={styles.metaRow}>
          <View style={styles.metaLeftGroup}>
            <Text style={styles.metaText}>{metaText}</Text>

            {isLogged && <LoggedBadge />}
          </View>

          <Text style={styles.metaCalories}>{caloriesText}</Text>
        </View>

        <View style={[styles.contentRow, previousEntry !== null && styles.contentRowFlush]}>
          <View style={[isLogged && styles.tileMuted]}>
            <MealIconTile iconKey={meal.recipe.iconKey} />
          </View>

          <View style={styles.textColumn}>
            <Text style={[styles.recipeName, isLogged && styles.recipeNameLogged]}>{meal.recipe.name}</Text>

            <Text style={styles.recipeMeta}>{recipeMetaText}</Text>

            {flagText !== null && <Text style={styles.flagText}>{flagText}</Text>}
          </View>
        </View>
      </TouchableOpacity>

      {/* Figma draws no swapped-after-logging card: the replacement is never presented as logged, so it
          renders unlogged and this caption names the meal that went to the diary, where it is untouched. */}
      {previousEntry !== null && (
        <View style={styles.swappedRow}>
          <Text style={styles.swappedCaption}>
            {stringWithNamedParameters(MEAL_PLAN_LOGGED_PREVIOUS_RECIPE_TEMPLATE, {
              recipe: previousEntry.recipeName
            })}
          </Text>

          <TouchableOpacity
            style={styles.swappedLinkButton}
            activeOpacity={Opacity.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_VIEW_IN_DIARY_ACCESSIBILITY_TEMPLATE, {
              recipe: previousEntry.recipeName
            })}
            onPress={onViewEntryPressed}>
            <Text style={styles.swappedLink}>{MEAL_PLAN_VIEW_IN_DIARY_BUTTON_TEXT}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.pillSecondary, isSwapDimmed && styles.pillDimmed]}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_SWAP_ACCESSIBILITY_TEMPLATE, {
            recipe: meal.recipe.name
          })}
          accessibilityState={{disabled: isSwapDimmed}}
          hitSlop={ACTION_PILL_HIT_SLOP}
          onPress={onSwapPressed}>
          <Text style={styles.pillLabelSecondary}>{MEAL_PLAN_SWAP_BUTTON_TEXT}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pillPrimary, isPrimaryDimmed && styles.pillDimmed]}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={primaryAccessibilityLabel}
          accessibilityState={{disabled: isPrimaryDimmed}}
          hitSlop={ACTION_PILL_HIT_SLOP}
          onPress={isLogged ? onViewEntryPressed : onLogPressed}>
          <Text style={styles.pillLabelPrimary}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * Memoized because the tab re-renders on every store and query change while a card's own inputs — the meal,
 * its resolved logged state and the four handlers — are all stable across those renders.
 */
export default React.memo(MealPlanCard)
