import React, {useState} from 'react'

import {ScrollView, TouchableOpacity, View} from 'react-native'

import {FoodSourceEnum, formatServingText} from '@data/models/Food'
import {InputMethodEnum} from '@data/models/MealEntry'
import {Navigation} from '@navigation/types'
import {FoodDetailRouteProp} from '@navigation/types'
import {useCreateFoodMutation} from '@queries/foods/useCreateFoodMutation'
import {useLogMealEntryMutation} from '@queries/macros/useLogMealEntryMutation'
import {useUpdateMealEntryMutation} from '@queries/macros/useUpdateMealEntryMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {useSessionStore} from '@store/session/useSessionStore'
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
  SERVINGS_HEADER,
  THIS_ADDS_LABEL,
  TOAST_ADDED_TO_MEAL_PREFIX,
  TOAST_GENERIC_ERROR,
  UPDATE_SERVINGS_BUTTON_TEXT
} from '@constants/strings'

import MacroDonut, {MACRO_COLORS} from './components/MacroDonut'
import styles from './index.styled'
import {
  buildMacroBreakdown,
  dominantMacroKey,
  formatDetailSubtitle,
  formatMacroSummary,
  MACRO_LABELS,
  MacroKey
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

  const macroSource = params.path === 'add' ? params.food : params.entry
  const servingText = params.path === 'add' ? formatServingText(params.food) : params.entry.servingText
  const brand = params.path === 'add' ? params.food.brand : null

  const perServing: PerServingMacros = {
    calories: macroSource.calories,
    protein: macroSource.protein,
    carbs: macroSource.carbs,
    fat: macroSource.fat
  }

  const breakdown = buildMacroBreakdown(perServing.protein, perServing.carbs, perServing.fat)

  const [servings, setServings] = useState(params.path === 'update' ? params.entry.servings : 1)
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>(() => dominantMacroKey(breakdown))

  const totals = scaleMacros(perServing, servings)
  const isSubmitting =
    createFoodMutation.isPending || logMealEntryMutation.isPending || updateMealEntryMutation.isPending

  const onAddPressed = async () => {
    if (params.path !== 'add') {
      return
    }

    const {mealId, food} = params

    try {
      let foodId = food.id
      let inputMethod = InputMethodEnum.LIBRARY

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

      <View style={styles.servingsCard}>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>{SERVINGS_HEADER}</Text>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepperButton}
              activeOpacity={0.7}
              onPress={() => setServings(current => stepServings(current, -1))}>
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.stepperValue}>{formatServingsDisplay(servings)}</Text>

            <TouchableOpacity
              style={styles.stepperButton}
              activeOpacity={0.7}
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
                activeOpacity={0.7}
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
