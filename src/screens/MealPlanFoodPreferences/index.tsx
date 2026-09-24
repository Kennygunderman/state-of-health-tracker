import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {View} from 'react-native'

import type {DislikedFoodSummary} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {useAccessibilityAnnouncement} from '@hooks/useAccessibilityAnnouncement'
import {MealPlanFoodPreferencesRouteProp, Navigation} from '@navigation/types'
import {useCatalogSuggestionsQuery} from '@queries/catalog/useCatalogSuggestionsQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {isDislikeSelectionAtCap, MAX_DISLIKED_FOOD_IDS} from '@utility/DislikeSelectionUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import CatalogSearchField from '@components/CatalogSearchField'
import ChipCloud, {CHIP_BAND_HIT_SLOP} from '@components/ChipCloud'
import ColumnScrollView from '@components/ColumnScrollView'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import PrimaryButton from '@components/PrimaryButton'
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
  MEAL_PLAN_DISLIKES_CAP_TEMPLATE,
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
import {
  buildDislikeLabelIndex,
  buildSelectedDislikes,
  foodPreferencesWizardProgress,
  resolveFoodPreferencesControls,
  resolveSuggestionsViewState
} from './index.util'

// Three chip-shaped blocks stand in for the suggestions cloud while it loads, a state no frame in this flow
// draws. The keys are the placeholders' own identity: no data sits behind them.
const SUGGESTION_SKELETON_KEYS: readonly string[] = Object.freeze(['first', 'second', 'third'])

// The draft carries ids where the saved row carries {id, name, foodGroup} summaries, so a rejected revision
// is compared on this projection of both sides rather than on a model field. Ids are primitives, which
// resolveStaleRevision compares as a multiset, so a reordered selection is never reported as a conflict.
interface DislikesConflictShape {
  dislikedFoodIds: string[]
}

// The one answer this step owns: a diet or meal time edited elsewhere is not a conflict here.
const DISLIKES_CONFLICT_FIELDS: readonly (keyof DislikesConflictShape & string)[] = Object.freeze(['dislikedFoodIds'])

const MealPlanFoodPreferencesScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanFoodPreferencesRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const {
    data: preferencesData,
    isPending: isLoadingPreferences,
    refetch: refetchPreferences
  } = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const {
    data: suggestionsData,
    isPending: isLoadingSuggestions,
    isError: hasSuggestionsError
  } = useCatalogSuggestionsQuery()
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, dislikeLabels, seeded, seedFromPreferences, toggleDislikedFood} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel, so this step's unsaved edits are dropped on the way out —
  // by whichever exit the user takes. A successful save marks them stored first, so leaving keeps them.
  const {markSaved: markDislikesSaved, discardEdits: discardDislikeEdits} = useSetupStepEdit(
    'dislikes',
    params.mode === 'edit'
  )

  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesData ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const progress = foodPreferencesWizardProgress(preferences?.targetRoute ?? null)
  const suggestions = suggestionsData ?? []
  const suggestionsState = resolveSuggestionsViewState(isLoadingSuggestions, hasSuggestionsError)
  const controls = resolveFoodPreferencesControls({
    isPreferencesPending: isLoadingPreferences,
    isSavePending: isSaving,
    suggestionsState
  })

  // The reducers behind every add path refuse the id past the hundredth, matching the bound the server
  // enforces on the distinct count. A refused tap returns the identical selection, so without this the
  // suggestion chips would simply stop responding; the caption below says why while removal keeps working.
  const isSelectionAtCap = isDislikeSelectionAtCap(draft.dislikedFoodIds)
  const dislikesCapMessage = stringWithNamedParameters(MEAL_PLAN_DISLIKES_CAP_TEMPLATE, {
    count: MAX_DISLIKED_FOOD_IDS
  })

  // The caption is the only answer a refused tap gets, and the live region that carries it is Android-only in
  // RN 0.86, so VoiceOver is told the same sentence when the cap is reached and only there.
  useAccessibilityAnnouncement(isSelectionAtCap ? dislikesCapMessage : null, {scope: 'voiceOver'})

  // The chips render names while the payload carries ids, so all three sources of a name are merged into one
  // lookup — and the flow's own index is what names a food staged from catalog search, which neither the
  // saved row nor the suggestions list can name until a save has landed. Every selected food therefore has a
  // chip the user can review and remove, and the count below is the selection's own length.
  const selectedDislikes = useMemo(
    () =>
      buildSelectedDislikes(
        draft.dislikedFoodIds,
        buildDislikeLabelIndex(dislikeLabels, preferences?.dislikedFoods ?? [], suggestionsData ?? [])
      ),
    [dislikeLabels, draft.dislikedFoodIds, preferences?.dislikedFoods, suggestionsData]
  )

  // The band is virtualized, so the chip is built by a renderer the list calls for the rows it mounts
  // rather than by a hundred elements handed over on every render.
  const renderSelectedChip = useCallback(
    (food: DislikedFoodSummary): React.JSX.Element => (
      <SelectableChip label={food.name} selected removable onPress={() => toggleDislikedFood(food)} />
    ),
    [toggleDislikedFood]
  )

  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markDislikesSaved()

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_SCHEDULE, params)
  }, [markDislikesSaved, navigation, params, returnFromTargets])

  const onSearchPressed = useCallback((): void => {
    navigation.push(Screens.MEAL_PLAN_FOOD_SEARCH, {mode: params.mode})
  }, [navigation, params.mode])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    // The server requires this step's exact revision, so a query that never produced one is asked again.
    let current = preferences

    if (current === null) {
      const refetchedRow = await refetchPreferences()

      current = refetchedRow.data ?? null
    }

    if (current === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveSetupStep({
        step: 'dislikes',
        payload: {
          dislikedFoodIds: draft.dislikedFoodIds,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: current.revision
        }
      })
    } catch (error) {
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): equal ids mean this client's own lost write, or
      // the identical edit from another device, already landed, so it resolves silently rather than writing again.
      const refetched = await refetchPreferences()
      const fresh = authoritativeRefetch(refetched)

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

      setHasConflict(true)

      return
    }

    advance()
  }, [advance, draft.dislikedFoodIds, preferences, refetchPreferences, saveSetupStep])

  // 'Use theirs' discards this step's draft ids in favour of the refetched row. Seeding adopts that row as
  // the stored answers without overwriting any step the user has edited — which is what protects the other
  // steps here, and also why this step's own edits have to be dropped explicitly afterwards.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    seedFromPreferences(preferences)
    discardDislikeEdits()
  }, [discardDislikeEdits, preferences, seedFromPreferences])

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ContentColumn>
        <ColumnScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Reopened from a Review or Plan settings row this screen is one step on its own, so it carries the
              back button alone: the segments and the "n of m" counter state setup-flow progress (0.7.4). */}
          <WizardHeader
            step={progress.step}
            totalSteps={progress.totalSteps}
            onBack={navigation.goBack}
            isProgressVisible={params.mode !== 'edit'}
          />

          <Text style={styles.headline} accessibilityRole="header">
            {MEAL_PLAN_FOOD_PREFERENCES_TITLE}
          </Text>

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

          {selectedDislikes.count > 0 && (
            <>
              <View style={[styles.sectionWrapper, styles.sectionWrapperFirst]}>
                <SectionOverline
                  text={stringWithNamedParameters(MEAL_PLAN_SELECTED_COUNT_TEMPLATE, {count: selectedDislikes.count})}
                  isHeading
                />
              </View>

              {/* 47:287 draws this row 40px — an 8px rung over one 32px chip — which the rung below plus a
                  band hugging its chips measures without any minimum height. The band reserves the chips'
                  slop inside its own box and hands the height back, so the reserved band falls outside this
                  wrapper: the slop here is what lets a touch reach it. */}
              <View style={styles.cloudWrapper} hitSlop={CHIP_BAND_HIT_SLOP}>
                <ChipCloud variant="scroll" items={selectedDislikes.foods} renderChip={renderSelectedChip} />
              </View>
            </>
          )}

          <View style={[styles.sectionWrapper, selectedDislikes.count === 0 && styles.sectionWrapperFirst]}>
            <SectionOverline text={MEAL_PLAN_SUGGESTIONS_HEADER} isHeading />
          </View>

          {/* 47:303 draws the suggestion cloud 80px — an 8px rung over two 32px rows at a 40px pitch — which
              the skeleton already measures at Sizes.CHIP and the loaded cloud now matches, so the block no
              longer grows when the suggestions arrive. The cloud reserves the chips' slop inside its own box
              and hands the height back, so the reserved band falls outside this wrapper: the slop here is
              what lets a touch reach it. */}
          <View style={styles.cloudWrapper} hitSlop={CHIP_BAND_HIT_SLOP}>
            {suggestionsState === 'loading' && (
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

            {suggestionsState === 'unavailable' && (
              <Text style={styles.helperText}>{MEAL_PLAN_SUGGESTIONS_UNAVAILABLE_TEXT}</Text>
            )}

            {suggestionsState === 'ready' && (
              <ChipCloud>
                {suggestions.map(suggestion => (
                  <SelectableChip
                    key={suggestion.id}
                    label={suggestion.name}
                    selected={draft.dislikedFoodIds.includes(suggestion.id)}
                    onPress={() => toggleDislikedFood(suggestion)}
                  />
                ))}
              </ChipCloud>
            )}
          </View>

          <Text style={styles.helperText}>{MEAL_PLAN_FOOD_PREFERENCES_HELPER_TEXT}</Text>

          {/* Mounted whether or not it carries the notice: a live region announces what changes inside it,
              so one that appears already holding its text is never read out. */}
          <View accessibilityLiveRegion="polite">
            {isSelectionAtCap && <Text style={styles.helperText}>{dislikesCapMessage}</Text>}
          </View>
        </ColumnScrollView>
      </ContentColumn>

      <SetupFooter>
        <View style={styles.footerContent}>
          {/* This step is optional (47:338) and 0.7.4 reserves a disabled CTA for a pending write, so the
              only flag the button takes is the save's own. */}
          <PrimaryButton
            label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
            isLoading={controls.isContinueLoading}
            onPress={onContinuePressed}
          />
        </View>
      </SetupFooter>

      <ConfirmModal
        isVisible={hasConflict}
        confirmationTitle={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        confirmButtonText={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        confirmButtonColor={Theme.colors.accentGreen}
        cancelButtonText={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        cancelButtonColor={Theme.colors.track}
        isConfirmPending={isSaving}
        avoidKeyboard
        onConfirmPressed={onContinuePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanFoodPreferencesScreen
