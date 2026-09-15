import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {ScrollView, View} from 'react-native'

import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanFoodPreferencesRouteProp, Navigation} from '@navigation/types'
import {useCatalogSuggestionsQuery} from '@queries/catalog/useCatalogSuggestionsQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import CatalogSearchField from '@components/CatalogSearchField'
import ChipCloud from '@components/ChipCloud'
import ContentColumn from '@components/ContentColumn'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
import SectionOverline from '@components/SectionOverline'
import SelectableChip from '@components/SelectableChip'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_FOOD_PREFERENCES_HELPER_TEXT,
  MEAL_PLAN_FOOD_PREFERENCES_SUBTITLE,
  MEAL_PLAN_FOOD_PREFERENCES_TITLE,
  MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_SELECTED_COUNT_TEMPLATE,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_SUGGESTIONS_HEADER,
  MEAL_PLAN_SUGGESTIONS_UNAVAILABLE_TEXT,
  TOAST_GENERIC_ERROR,
  stringWithNamedParameters
} from '@constants/strings'

import styles, {SUGGESTION_SKELETON_HEIGHT, SUGGESTION_SKELETON_WIDTH} from './index.styled'

// Dislikes is the fifth step of seven, or the fourth of six on the manual-target route, which skips the
// calculation-only Activity step. The folder carries no util, so the two shapes sit here.
const ESTIMATED_ROUTE_PROGRESS = {step: 5, totalSteps: 7}

const MANUAL_ROUTE_PROGRESS = {step: 4, totalSteps: 6}

// Three chip-shaped blocks stand in for the suggestions cloud while it loads, a state no frame in this flow
// draws. The keys are the placeholders' own identity: no data sits behind them.
const SUGGESTION_SKELETON_KEYS: readonly string[] = Object.freeze(['first', 'second', 'third'])

// The draft carries ids where the saved row carries {id, name, foodGroup} summaries, so a rejected revision
// is compared on this projection of both sides rather than on a model field. Ids are primitives, which
// resolveStaleRevision compares as a multiset, so a reordered selection is never reported as a conflict.
interface DislikesConflictShape {
  dislikedFoodIds: string[]
}

// The one answer this step owns, so a dislike saved here is never reported as conflicting with a diet or a
// meal time someone edited on another device.
const DISLIKES_CONFLICT_FIELDS: readonly (keyof DislikesConflictShape & string)[] = Object.freeze(['dislikedFoodIds'])

const MealPlanFoodPreferencesScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanFoodPreferencesRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  const preferencesQuery = useMealPlanPreferencesQuery()
  const suggestionsQuery = useCatalogSuggestionsQuery()
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, toggleDislikedFood} = useMealPlanSetupDraft()

  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesQuery.data ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const progress = preferences?.targetRoute === 'manual' ? MANUAL_ROUTE_PROGRESS : ESTIMATED_ROUTE_PROGRESS
  const suggestions = suggestionsQuery.data ?? []

  // The chips render names while the draft holds ids, so the two name sources this screen already has are
  // merged into one lookup. An id neither can name — a food staged on 06b straight from catalog search —
  // stays in the draft and is still saved; its name arrives once the save invalidates the preferences query.
  const selectedChips = useMemo(() => {
    const namedFoods = [...(preferences?.dislikedFoods ?? []), ...(suggestionsQuery.data ?? [])]
    const namesById = new Map(namedFoods.map(food => [food.id, food.name] as const))

    return draft.dislikedFoodIds.flatMap(id => {
      const label = namesById.get(id)

      return label === undefined ? [] : [{id, label}]
    })
  }, [draft.dislikedFoodIds, preferences?.dislikedFoods, suggestionsQuery.data])

  const advance = useCallback((): void => {
    setHasConflict(false)

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_SCHEDULE, params)
  }, [navigation, params, returnFromTargets])

  const onSearchPressed = useCallback((): void => {
    navigation.push(Screens.MEAL_PLAN_FOOD_SEARCH, {mode: params.mode})
  }, [navigation, params.mode])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    // Nothing here is required (47:338), so the step has no answer to validate and no inline error to
    // report. Its one precondition is the revision the save must carry: when the preferences query failed,
    // it is refetched here rather than sending a write the server would answer 409.
    let current = preferences

    if (current === null) {
      const refetchedRow = await preferencesQuery.refetch()

      current = refetchedRow.data ?? null
    }

    if (current === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveStepMutation.mutateAsync({
        step: 'dislikes',
        payload: {
          dislikedFoodIds: draft.dislikedFoodIds,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: current.revision
        }
      })
    } catch (error) {
      // The selection lives in the provider draft, so a failed save loses none of it and nothing navigates.
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): the authoritative row is refetched and this
      // step's own answer is compared with it. Equal ids mean the write this client lost the response to, or
      // the identical edit from another device, already landed — so it resolves silently rather than
      // reporting a conflict or writing a second time.
      const refetched = await preferencesQuery.refetch()
      const fresh = refetched.data ?? null

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      if (
        resolveStaleRevision<DislikesConflictShape>(
          {dislikedFoodIds: draft.dislikedFoodIds},
          {dislikedFoodIds: fresh.dislikedFoods.map(food => food.id)},
          DISLIKES_CONFLICT_FIELDS
        ).status === 'resolved'
      ) {
        advance()

        return
      }

      // A real difference is the user's to settle, so it raises the persistent dialog rather than a toast
      // that fades: 'Keep mine' re-presses this save, which by then closes over the revision just
      // refetched, and a second rejection repeats the cycle.
      setHasConflict(true)

      return
    }

    advance()
  }, [advance, draft.dislikedFoodIds, preferences, preferencesQuery, saveStepMutation])

  // 'Use theirs' discards this step's draft ids in favour of the refetched row; seeding reads the whole
  // saved row, so every other step's edits survive it.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    seedFromPreferences(preferences)
  }, [preferences, seedFromPreferences])

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ContentColumn>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <WizardHeader step={progress.step} totalSteps={progress.totalSteps} onBack={navigation.goBack} />

          <Text style={styles.headline}>{MEAL_PLAN_FOOD_PREFERENCES_TITLE}</Text>

          <Text style={styles.subCopy}>{MEAL_PLAN_FOOD_PREFERENCES_SUBTITLE}</Text>

          <View style={styles.fieldWrapper}>
            <CatalogSearchField
              mode="tapTarget"
              value=""
              placeholder={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
              accessibilityLabel={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
              onPress={onSearchPressed}
            />
          </View>

          {selectedChips.length > 0 && (
            <>
              <View style={[styles.sectionWrapper, styles.sectionWrapperFirst]}>
                <SectionOverline
                  text={stringWithNamedParameters(MEAL_PLAN_SELECTED_COUNT_TEMPLATE, {count: selectedChips.length})}
                />
              </View>

              <View style={styles.cloudWrapper}>
                <ChipCloud variant="scroll">
                  {selectedChips.map(chip => (
                    <SelectableChip
                      key={chip.id}
                      label={chip.label}
                      selected
                      removable
                      expandTouchTarget
                      onPress={() => toggleDislikedFood(chip.id)}
                    />
                  ))}
                </ChipCloud>
              </View>
            </>
          )}

          <View style={[styles.sectionWrapper, selectedChips.length === 0 && styles.sectionWrapperFirst]}>
            <SectionOverline text={MEAL_PLAN_SUGGESTIONS_HEADER} />
          </View>

          <View style={styles.cloudWrapper}>
            {suggestionsQuery.isPending && (
              <View style={styles.skeletonRow} accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
                {SUGGESTION_SKELETON_KEYS.map(key => (
                  <SkeletonBlock
                    key={key}
                    height={SUGGESTION_SKELETON_HEIGHT}
                    width={SUGGESTION_SKELETON_WIDTH}
                    borderRadius={BorderRadius.PILL}
                  />
                ))}
              </View>
            )}

            {suggestionsQuery.isError && (
              <Text style={styles.helperText}>{MEAL_PLAN_SUGGESTIONS_UNAVAILABLE_TEXT}</Text>
            )}

            {!suggestionsQuery.isPending && !suggestionsQuery.isError && (
              <ChipCloud>
                {suggestions.map(suggestion => (
                  <SelectableChip
                    key={suggestion.id}
                    label={suggestion.name}
                    selected={draft.dislikedFoodIds.includes(suggestion.id)}
                    expandTouchTarget
                    onPress={() => toggleDislikedFood(suggestion.id)}
                  />
                ))}
              </ChipCloud>
            )}
          </View>

          <Text style={styles.helperText}>{MEAL_PLAN_FOOD_PREFERENCES_HELPER_TEXT}</Text>
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        <View style={styles.footerContent}>
          <PrimaryButton
            label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
            isLoading={saveStepMutation.isPending}
            disabled={preferencesQuery.isPending}
            onPress={onContinuePressed}
          />
        </View>
      </SetupFooter>

      <RevisionConflictDialog
        isVisible={hasConflict}
        title={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        keepMineLabel={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        useTheirsLabel={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        isKeepMinePending={saveStepMutation.isPending}
        onKeepMine={onContinuePressed}
        onUseTheirs={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanFoodPreferencesScreen
