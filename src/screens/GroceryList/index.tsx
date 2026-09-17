import React, {useCallback, useEffect, useMemo, useRef} from 'react'

import {FlatList, ListRenderItemInfo, TouchableOpacity, useWindowDimensions, View} from 'react-native'

import type {GroceryItem} from '@data/models/GroceryList'
import {GroceryListRouteProp, Navigation} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useGroceryListQuery} from '@queries/mealPlanning/useGroceryListQuery'
import {useToggleGroceryItemMutation} from '@queries/mealPlanning/useToggleGroceryItemMutation'
import {useUncheckAllGroceriesMutation} from '@queries/mealPlanning/useUncheckAllGroceriesMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {SafeAreaView} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import EmptyState from '@components/EmptyState'
import GroceryCartIcon from '@components/icons/GroceryCartIcon'
import InfoBanner from '@components/InfoBanner'
import SectionOverline from '@components/SectionOverline'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  GROCERY_EMPTY_PLAN_BODY,
  GROCERY_EMPTY_PLAN_TITLE,
  GROCERY_LIST_TITLE,
  GROCERY_NO_PLAN_BODY,
  GROCERY_NO_PLAN_TITLE,
  GROCERY_STILL_ON_LIST_CAPTION,
  GROCERY_UNCHECK_ALL_BUTTON_TEXT,
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CREATE_BUTTON_TEXT,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_TITLE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
} from '@constants/strings'

import GroceryRow from './components/GroceryRow'
import GrocerySectionHeader from './components/GrocerySectionHeader'
import styles, {UNCHECK_ALL_HIT_SLOP} from './index.styled'
import {
  buildGroceryViewModel,
  classifyGroceryWriteFailure,
  contentColumnWidth,
  EMPTY_GROCERY_VIEW_MODEL,
  GroceryBlock,
  groceryEyebrow,
  groceryReadRecovery,
  groceryRowVariant,
  isGroceryPlanStateRefusal,
  resolveGroceryPlanScope,
  resolveGroceryView
} from './index.util'

// 13c's skeleton vocabulary, shaped like the loaded screen: a section label, then a card per aisle it stands in for.
const SKELETON_BLOCKS: ReadonlyArray<{height: number; borderRadius: number}> = [
  {height: Sizes.SKELETON_BAR, borderRadius: BorderRadius.CHECKBOX},
  {height: Sizes.CONTROL_LG, borderRadius: BorderRadius.CARD_LG},
  {height: Sizes.CONTROL_LG, borderRadius: BorderRadius.CARD_LG}
]

// Both write hooks are scoped to a plan, and this screen can open without one (14c). The empty id is never
// sent: every control that fires them renders only inside a decoded list, which exists only for a real plan.
const NO_PLAN_ID = ''

/**
 * Frames 14 / 14b / 14c: the week's shopping list, its checked block and the two writes that move items
 * between them.
 *
 * Both writes are optimistic in their mutation hooks, so this screen reports a failure rather than reverting
 * anything itself: the row returns to where it was and a toast says so, and nothing here navigates on failure.
 * The one failure it does act on is a confirmed plan-state refusal — on a write or on the list read — which
 * earns the stale-plan copy and a current-plan re-read so the shopper is not left writing to a superseded
 * list (0.2.5).
 */
const GroceryListScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<GroceryListRouteProp>()
  const {width} = useWindowDimensions()

  // Written only when a plan-state refusal hands this flow back to the plan tab, so the tab it lands on is the
  // Meal Plan segment whose refreshed current-plan answer owns which plan is selected (0.7.4).
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  // Opening the list without a plan id means "shop the plan I am on", so the current plan answers for it —
  // and only then. With an id already in hand the read would be a second /plans/current request and a second
  // rollover observer for an answer this screen would never consult, so the hook's own `enabled` turns it off.
  const currentPlanQuery = useCurrentMealPlanQuery(params.planId === null)

  const currentPlanData = currentPlanQuery.data
  const isCurrentPlanError = currentPlanQuery.isError
  const refetchCurrentPlan = currentPlanQuery.refetch

  const planScope = useMemo(
    () =>
      resolveGroceryPlanScope({
        routePlanId: params.planId,
        currentPlan: {isError: isCurrentPlanError, data: currentPlanData}
      }),
    [currentPlanData, isCurrentPlanError, params.planId]
  )

  const planId = planScope.kind === 'plan' ? planScope.planId : null

  const groceryQuery = useGroceryListQuery(planId)
  const toggleMutation = useToggleGroceryItemMutation(planId ?? NO_PLAN_ID)
  const uncheckAllMutation = useUncheckAllGroceriesMutation(planId ?? NO_PLAN_ID)

  const view = useMemo(
    () =>
      resolveGroceryView(
        {isLoading: groceryQuery.isLoading, isError: groceryQuery.isError, data: groceryQuery.data},
        planScope
      ),
    [groceryQuery.data, groceryQuery.isError, groceryQuery.isLoading, planScope]
  )

  const eyebrow = groceryEyebrow(view)

  // The decoded list is the model's only input and its identity is the cache entry's, so the aisle ordering,
  // the checked-row ordering and the flag scan run once per answer instead of once per render — each optimistic
  // toggle renders this screen three times (pending, cache write, settle) over an unchanged whole list.
  const list = view.kind === 'list' ? view.list : null

  const viewModel = useMemo(() => (list === null ? EMPTY_GROCERY_VIEW_MODEL : buildGroceryViewModel(list)), [list])

  const hasLeftStalePlan = useRef(false)

  /**
   * Giving way to the current plan, which is what a confirmed plan-state refusal leaves this screen able to do.
   *
   * A re-read on its own cannot move a route-pinned list: the route names the plan and `resolveGroceryPlanScope`
   * honours it, so the shopper would stay on a superseded list ticking rows that can only be refused again. The
   * Meal Plan tab owns plan selection from the refreshed current/upcoming answer (0.7.4), so the flow hands
   * back to it — the same handover `SwapPreview` performs on these two codes, so a refused plan behaves the
   * same way whichever plan screen the user is standing on. Once per mount: the write path and the read path
   * can classify the same fact.
   */
  const leaveStalePlan = useCallback((): void => {
    if (hasLeftStalePlan.current) {
      return
    }

    hasLeftStalePlan.current = true
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [navigation, setMacrosSegment])

  // Both writes are optimistic and both roll themselves back in their mutation factories, so a rejection leaves
  // this screen nothing to undo: what it owns is the report and, for a confirmed plan-state refusal, the
  // current-plan re-read and the handover above — a refusal is about the plan, not the row, so no other row on
  // this list would fare any better (0.2.5).
  const reportWriteFailure = (error: unknown): void => {
    const failure = classifyGroceryWriteFailure(error)

    showToast('error', failure.toast)

    if (failure.refetchCurrentPlan) {
      refetchCurrentPlan()
    }

    if (failure.leaveStalePlan) {
      leaveStalePlan()
    }
  }

  const onToggleItem = async (item: GroceryItem): Promise<void> => {
    try {
      await toggleMutation.mutateAsync({itemId: item.id, isChecked: !item.isChecked})
    } catch (error) {
      reportWriteFailure(error)
    }
  }

  const onUncheckAllPressed = async (): Promise<void> => {
    try {
      await uncheckAllMutation.mutateAsync()
    } catch (error) {
      reportWriteFailure(error)
    }
  }

  const groceryQueryError = groceryQuery.error

  // The read path is classified the same way: a decoded `stale_plan` / `plan_not_active` earns the code's own
  // copy and a plan re-read, which the generic retry card could never resolve (0.2.5). The ref keeps one
  // failure to one toast — the list query's identity changes with the plan id and with every settle
  // invalidation, so this effect re-runs on a failure the user has already been told about.
  const hasAnnouncedPlanState = useRef(false)

  useEffect(() => {
    const recovery = groceryReadRecovery({error: groceryQueryError, hasAnnounced: hasAnnouncedPlanState.current})

    hasAnnouncedPlanState.current = recovery.isPlanStateFailure

    if (recovery.toast !== null) {
      showToast('error', recovery.toast)
    }

    if (recovery.refetchCurrentPlan) {
      refetchCurrentPlan()
    }

    if (recovery.leaveStalePlan) {
      leaveStalePlan()
    }
  }, [groceryQueryError, leaveStalePlan, refetchCurrentPlan])

  // A row is busy while its own toggle is in flight, and every row is busy while the whole list is being
  // cleared: a second press during either would write against a count the server is already changing.
  const isRowPending = (item: GroceryItem): boolean =>
    uncheckAllMutation.isPending || (toggleMutation.isPending && toggleMutation.variables?.itemId === item.id)

  /**
   * 37:35 then 37:38, in that order on every screen: the eyebrow 16 below the back row and the title 4 below the
   * eyebrow. Held in one place so the two header shapes — beside the action (37:32) and without it (37:371) —
   * cannot drift apart. The overline renders even where a state has nothing to say (loading, error), so the
   * title keeps its own rung instead of moving up as the screen resolves.
   */
  const overlineAndTitle = (): React.JSX.Element => (
    <>
      <SectionOverline text={eyebrow.text} tone={eyebrow.tone} />

      <Text style={styles.title}>{GROCERY_LIST_TITLE}</Text>
    </>
  )

  const loadingBlock = (): React.JSX.Element => (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SKELETON_BLOCKS.map((block, index) => (
        <View key={`${block.height}-${index}`} style={styles.skeletonRow}>
          <SkeletonBlock
            height={block.height}
            // Skeleton takes a number, so the card's width is computed the way ContentColumn derives it.
            width={contentColumnWidth(width)}
            borderRadius={block.borderRadius}
          />
        </View>
      ))}
    </View>
  )

  // The retry belongs to the read that actually failed: with no plan resolved that is the current-plan lookup,
  // and inside a plan it is the list itself.
  const onRetryLoadPressed = (): void => {
    if (planScope.kind === 'unavailable') {
      refetchCurrentPlan()

      return
    }

    groceryQuery.refetch()
  }

  // A plan-state failure keeps the card but drops its retry: refetching the same superseded plan cannot answer
  // differently, and the code's own copy was raised as a toast instead (0.2.5).
  const canRetryLoad = !isGroceryPlanStateRefusal(groceryQueryError)

  const errorBlock = (): React.JSX.Element => (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{MEAL_PLAN_LOAD_ERROR_TITLE}</Text>

      {canRetryLoad && (
        <TouchableOpacity
          style={styles.errorRetryPill}
          accessibilityRole="button"
          accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
          onPress={onRetryLoadPressed}>
          <Text style={styles.errorRetryLabel}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  const noPlanBlock = (): React.JSX.Element => (
    <View style={styles.emptyStateContainer}>
      <EmptyState
        icon={<GroceryCartIcon variant="empty" color={Theme.colors.accentGreen} />}
        headline={GROCERY_NO_PLAN_TITLE}
        body={GROCERY_NO_PLAN_BODY}
        variant="tile"
        bottomInset="lg"
        primaryLabel={MEAL_PLAN_CREATE_BUTTON_TEXT}
        onPrimary={() => navigation.push(Screens.MEAL_PLAN_INTRO)}
      />
    </View>
  )

  // A plan with no items keeps the plan's own copy and carries no action at all (AAP 0.2.5): it is neither an
  // invitation to create the plan that already exists, nor a claim about how the list came to be empty.
  const emptyListBlock = (): React.JSX.Element => (
    <View style={styles.emptyStateContainer}>
      <EmptyState
        icon={<GroceryCartIcon variant="empty" color={Theme.colors.accentGreen} />}
        headline={GROCERY_EMPTY_PLAN_TITLE}
        body={GROCERY_EMPTY_PLAN_BODY}
        variant="tile"
        bottomInset="lg"
      />
    </View>
  )

  const renderBlock = ({item: block}: ListRenderItemInfo<GroceryBlock>): React.JSX.Element => (
    <>
      {block.kind === 'category' ? (
        <GrocerySectionHeader kind="category" label={block.label} isFirst={block.isFirst} />
      ) : (
        <GrocerySectionHeader kind="checked" title={block.title} caption={GROCERY_STILL_ON_LIST_CAPTION} />
      )}

      <View style={styles.sectionCard}>
        {block.items.map((item, index) => (
          <GroceryRow
            key={item.id}
            item={item}
            variant={groceryRowVariant(item)}
            isFirst={index === 0}
            isPending={isRowPending(item)}
            onToggle={() => onToggleItem(item)}
          />
        ))}
      </View>
    </>
  )

  // What the list shows in place of its rows. An error never draws the 14c no-plan state — AAP 0.2.5 reserves
  // that for a plan that does not exist, and the decoded-empty copy for a plan whose list is genuinely empty.
  const emptyBlock = (): React.JSX.Element | null => {
    switch (view.kind) {
      case 'loading':
        return loadingBlock()
      case 'error':
        return errorBlock()
      case 'noPlan':
        return noPlanBlock()
      case 'emptyList':
        return emptyListBlock()
      case 'list':
        return null
    }
  }

  const {blocks, banner, showsUncheckAll} = viewModel

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        <FlatList
          data={blocks}
          keyExtractor={block => block.key}
          renderItem={renderBlock}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            view.kind === 'noPlan' || view.kind === 'emptyList' ? styles.listContentEmpty : styles.listContent
          }
          ListHeaderComponent={
            <>
              <View style={styles.backRow}>
                <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

                <Text style={styles.backLabel}>{MEAL_PLAN_TITLE}</Text>
              </View>

              {showsUncheckAll ? (
                <View style={styles.eyebrowRow}>
                  <View style={styles.headerStack}>{overlineAndTitle()}</View>

                  <TouchableOpacity
                    style={styles.uncheckAllButton}
                    hitSlop={UNCHECK_ALL_HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={GROCERY_UNCHECK_ALL_BUTTON_TEXT}
                    accessibilityState={{busy: uncheckAllMutation.isPending, disabled: uncheckAllMutation.isPending}}
                    disabled={uncheckAllMutation.isPending}
                    onPress={onUncheckAllPressed}>
                    <Text style={styles.uncheckAllLabel}>{GROCERY_UNCHECK_ALL_BUTTON_TEXT}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // 37:371 and 37:374: with nothing to sit beside, the row is gone and the overline and the title are
                // plain blocks on the same two rungs.
                <View style={styles.overlineBlock}>{overlineAndTitle()}</View>
              )}

              {banner !== null && (
                <View style={styles.bannerContainer}>
                  <InfoBanner tone={banner.tone} glyph={banner.glyph} title={banner.title} body={banner.body} />
                </View>
              )}
            </>
          }
          ListEmptyComponent={emptyBlock()}
        />
      </ContentColumn>
    </SafeAreaView>
  )
}

export default GroceryListScreen
