import React, {useEffect, useMemo, useState} from 'react'

import {ScrollView, TouchableOpacity, View} from 'react-native'

import {FoodSourceEnum, formatServingText, isCatalogFood} from '@data/models/Food'
import {ClientInputMethod, InputMethodEnum} from '@data/models/MealEntry'
import {Navigation} from '@navigation/types'
import {FoodDetailRouteProp} from '@navigation/types'
import {useCreateFoodMutation} from '@queries/foods/useCreateFoodMutation'
import {useLogMealEntryMutation} from '@queries/macros/useLogMealEntryMutation'
import {useUpdateMealEntryMutation} from '@queries/macros/useUpdateMealEntryMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {useSessionStore} from '@store/session/useSessionStore'
import {Opacity} from '@styles/sizes'
import {
  applyFractionPart,
  formatServingsDisplay,
  isFractionSelected,
  PerServingMacros,
  scaleMacros,
  SERVING_FRACTIONS,
  stepServings
} from '@utility/ServingsUtility'

import MacroGramRow from '@components/MacroGramRow'
import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import {
  ADDING_TO_EYEBROW,
  CAL_LABEL,
  CAL_PER_SERVING_SUFFIX,
  MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SERVING_FRACTION_NAMES,
  SERVINGS_HEADER,
  stringWithNamedParameters,
  THIS_ADDS_LABEL,
  TOAST_ADDED_TO_MEAL_PREFIX,
  TOAST_GENERIC_ERROR,
  UPDATE_SERVINGS_BUTTON_TEXT
} from '@constants/strings'

import MacroDonut, {MACRO_COLORS} from './components/MacroDonut'
import styles from './index.styled'
import {
  buildCatalogLogPayload,
  buildMacroBreakdown,
  catalogProvenanceLabel,
  dominantMacroKey,
  formatDetailSubtitle,
  formatMacroSummary,
  MACRO_LABELS,
  MacroKey,
  resolveFoodDetailSource
} from './index.util'

// Missing from @constants/strings — the toast string is 'Added to' but there is
// no dedicated button-label constant for 'Add to {meal}'.
const ADD_TO_BUTTON_PREFIX = 'Add to'

const MACRO_KEYS: MacroKey[] = ['protein', 'carbs', 'fat']

const FoodDetailScreen = () => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<FoodDetailRouteProp>()

  const sessionStartDateIso = useSessionStore(state => state.sessionStartDateIso)
  const createFoodMutation = useCreateFoodMutation()
  const logMealEntryMutation = useLogMealEntryMutation(sessionStartDateIso)
  const updateMealEntryMutation = useUpdateMealEntryMutation(sessionStartDateIso)

  // A restored param is untrusted input, so the source is resolved through the
  // validating helper rather than read off the route; null means the param is
  // not a food and the screen leaves instead of rendering one whose provenance
  // is unknown.
  const source = useMemo(() => resolveFoodDetailSource(params), [params])
  const routeFood = source?.path === 'add' ? source.food : null
  const entry = source?.path === 'update' ? source.entry : null
  const macroSource = routeFood ?? entry

  const perServing: PerServingMacros = {
    calories: macroSource?.calories ?? 0,
    protein: macroSource?.protein ?? 0,
    carbs: macroSource?.carbs ?? 0,
    fat: macroSource?.fat ?? 0
  }

  const breakdown = buildMacroBreakdown(perServing.protein, perServing.carbs, perServing.fat)

  const [servings, setServings] = useState(entry?.servings ?? 1)
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>(() => dominantMacroKey(breakdown))

  const totals = scaleMacros(perServing, servings)
  const isSubmitting =
    createFoodMutation.isPending || logMealEntryMutation.isPending || updateMealEntryMutation.isPending

  useEffect(() => {
    if (macroSource) {
      return
    }

    showToast('error', TOAST_GENERIC_ERROR)
    navigation.goBack()
  }, [macroSource, navigation])

  const onAddPressed = async () => {
    if (params.path !== 'add' || !routeFood) {
      return
    }

    const {mealId} = params
    const food = routeFood

    try {
      // A published catalog food is logged by id: the server resolves the row and
      // derives the snapshot, so no library copy is created and no macros are sent
      if (isCatalogFood(food)) {
        await logMealEntryMutation.mutateAsync({
          mealId,
          payload: buildCatalogLogPayload(food, servings)
        })
      } else {
        let foodId = food.id
        // Annotated rather than inferred: the legacy body may only claim a
        // method the client is allowed to choose, and 'meal_plan' is the
        // server's alone.
        let inputMethod: ClientInputMethod = InputMethodEnum.LIBRARY

        // Branded results live in the external catalog — persist a copy into the
        // user's library first, then log against the created food
        if (food.source === FoodSourceEnum.BRANDED) {
          const createdFood = await createFoodMutation.mutateAsync({
            name: food.name,
            servingAmount: food.servingAmount,
            servingUnit: food.servingUnit ?? undefined,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            brand: food.brand ?? undefined,
            source: FoodSourceEnum.BRANDED
          })

          foodId = createdFood.id
          inputMethod = InputMethodEnum.SEARCH
        }

        await logMealEntryMutation.mutateAsync({
          mealId,
          payload: {
            foodId,
            name: food.name,
            servingText: formatServingText(food),
            servings,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            inputMethod
          }
        })
      }

      // Land back on Add Food (not Macros) so more items can be added to the
      // same meal without re-entering the flow
      navigation.goBack()

      showToast('success', `${TOAST_ADDED_TO_MEAL_PREFIX} ${params.mealName}`, food.name)
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  const onUpdatePressed = async () => {
    if (params.path !== 'update') {
      return
    }

    try {
      await updateMealEntryMutation.mutateAsync({entryId: params.entry.id, payload: {servings}})

      navigation.goBack()
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  // The effect above is already leaving; rendering nothing keeps the zeroed
  // placeholder figures off the screen while it does.
  if (!macroSource) {
    return null
  }

  const servingText = routeFood ? formatServingText(routeFood) : (entry?.servingText ?? null)
  const brand = routeFood?.brand ?? null
  const provenanceCaption = routeFood ? catalogProvenanceLabel(routeFood.nutritionProvenance) : null

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {params.path === 'add' && (
        <Text style={styles.eyebrow}>{`${ADDING_TO_EYEBROW} ${params.mealName.toUpperCase()}`}</Text>
      )}

      <Text style={styles.title}>{macroSource.name}</Text>

      <Text style={styles.subtitle}>
        {formatDetailSubtitle(brand, servingText, perServing.calories, CAL_PER_SERVING_SUFFIX)}
      </Text>

      <View style={styles.macroCard}>
        <MacroDonut slices={breakdown} selectedKey={selectedMacro} />

        <View style={styles.legend}>
          {MACRO_KEYS.map((key, index) => {
            const slice = breakdown.find(s => s.key === key)

            return (
              <MacroGramRow
                key={key}
                label={MACRO_LABELS[key]}
                grams={slice?.grams ?? 0}
                dotColor={MACRO_COLORS[key]}
                isLast={index === MACRO_KEYS.length - 1}
                onPress={() => setSelectedMacro(key)}
              />
            )
          })}
        </View>
      </View>

      {provenanceCaption && <Text style={styles.provenanceCaption}>{provenanceCaption}</Text>}

      <View style={styles.servingsCard}>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>{SERVINGS_HEADER}</Text>

          {/* The stepper and the chips below carry the same accessible names as their twin on the Log meal
              screen (LogPlannedMeal's ServingsStepper and FractionChips), so the two surfaces cannot drift. */}
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperButton}
              activeOpacity={Opacity.PRESSED_SUBTLE}
              accessibilityRole="button"
              accessibilityLabel={MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL}
              onPress={() => setServings(current => stepServings(current, -1))}>
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.stepperValue}>{formatServingsDisplay(servings)}</Text>

            <TouchableOpacity
              style={styles.stepperButton}
              activeOpacity={Opacity.PRESSED_SUBTLE}
              accessibilityRole="button"
              accessibilityLabel={MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL}
              onPress={() => setServings(current => stepServings(current, 1))}>
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fractionChipsRow}>
          {SERVING_FRACTIONS.map(fraction => {
            const isSelected = isFractionSelected(servings, fraction.value)

            return (
              <TouchableOpacity
                key={fraction.glyph}
                style={[styles.fractionChip, isSelected && styles.fractionChipSelected]}
                activeOpacity={Opacity.PRESSED_SUBTLE}
                accessibilityRole="button"
                // Screen readers pronounce ¼ ⅓ ½ ⅔ ¾ inconsistently, so the name spells the fraction out.
                accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE, {
                  fraction: MEAL_PLAN_SERVING_FRACTION_NAMES[fraction.glyph] ?? fraction.glyph
                })}
                accessibilityState={{selected: isSelected}}
                onPress={() => setServings(current => applyFractionPart(current, fraction.value))}>
                <Text style={[styles.fractionChipText, isSelected && styles.fractionChipTextSelected]}>
                  {fraction.glyph}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={styles.addsRow}>
        <Text style={styles.addsLabel}>{THIS_ADDS_LABEL}</Text>

        <Text style={styles.addsDetail}>
          <Text style={styles.addsCalories}>{`${totals.calories} ${CAL_LABEL}`}</Text>

          {` · ${formatMacroSummary(totals.protein, totals.carbs, totals.fat)}`}
        </Text>
      </View>

      <PrimaryButton
        style={styles.button}
        label={params.path === 'add' ? `${ADD_TO_BUTTON_PREFIX} ${params.mealName}` : UPDATE_SERVINGS_BUTTON_TEXT}
        isLoading={isSubmitting}
        onPress={params.path === 'add' ? onAddPressed : onUpdatePressed}
      />
    </ScrollView>
  )
}

export default FoodDetailScreen
