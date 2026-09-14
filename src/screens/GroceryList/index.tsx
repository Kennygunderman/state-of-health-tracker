import React, {useCallback, useEffect, useRef} from 'react'

import {FlatList, ListRenderItemInfo, TouchableOpacity, useWindowDimensions, View} from 'react-native'

import type {GroceryItem} from '@data/models/GroceryList'
import {GroceryListRouteProp, Navigation} from '@navigation/types'
import {queryKeys} from '@queries/keys'
import {useGroceryListQuery} from '@queries/mealPlanning/useGroceryListQuery'
import {useToggleGroceryItemMutation} from '@queries/mealPlanning/useToggleGroceryItemMutation'
import {useUncheckAllGroceriesMutation} from '@queries/mealPlanning/useUncheckAllGroceriesMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {useQueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
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
  GROCERY_CHECKED_HEADER_TEMPLATE,
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
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TITLE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import GroceryRow from './components/GroceryRow'
import GrocerySectionHeader from './components/GrocerySectionHeader'
import styles from './index.styled'
import {
  contentColumnWidth,
  countFlaggedItems,
  groceryBanner,
  groceryCategoryLabel,
  groceryEyebrow,
  groceryRowVariant,
  orderGrocerySections,
  resolveGroceryView,
  shouldShowUncheckAll
} from './index.util'

// Three cards, so the placeholder occupies the rhythm of the sections it stands in for.
const SKELETON_CARD_HEIGHTS: number[] = [Sizes.CONTROL_LG, Sizes.CONTROL_LG, Sizes.CONTROL_LG]

// Both write hooks are scoped to a plan, and this screen can open without one (14c). The empty id is never
// sent: every control that fires them renders only inside a decoded list, which exists only for a real plan.
const NO_PLAN_ID = ''

// `stale_plan` and `plan_not_active` are one outcome here: the plan this screen was opened for is no longer the
// one the server reads or writes, whichever request surfaced it (AAP 0.2.5).
const isPlanGoneCode = (code: string | null): boolean =>
  code === API_ERROR_CODES.planNotActive || code === API_ERROR_CODES.stalePlan

// Keys are namespaced so the Checked block can never collide with a category code the server adds later.
const CATEGORY_BLOCK_KEY_PREFIX = 'category:'
const CHECKED_BLOCK_KEY = 'checked'

/**
 * One list row per section, not per item: 37:338 draws a single card behind a whole aisle, and that card is the
 * screen's own style rather than the row's, so the block is the unit the list can lay out and recycle. Rows
 * inside it size to content, which is what AAP 0.7.4's text-scaling policy asks of this list.
 */
type GroceryBlock =
  | {kind: 'category'; key: string; label: string; isFirst: boolean; items: GroceryItem[]}
  | {kind: 'checked'; key: string; title: string; items: GroceryItem[]}

/**
 * Frames 14 / 14b / 14c: the week's shopping list, its checked block and the two writes that move items
 * between them.
 *
 * Both writes are optimistic in their mutation hooks, so this screen reports a failure rather than reverting
 * anything itself: the row returns to where it was and a toast says so, and nothing here navigates on failure.
 */
const GroceryListScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<GroceryListRouteProp>()
  const {width} = useWindowDimensions()
  const queryClient = useQueryClient()

  const groceryQuery = useGroceryListQuery(params.planId)
  const toggleMutation = useToggleGroceryItemMutation(params.planId ?? NO_PLAN_ID)
  const uncheckAllMutation = useUncheckAllGroceriesMutation(params.planId ?? NO_PLAN_ID)

  const view = resolveGroceryView(
    {isLoading: groceryQuery.isLoading, isError: groceryQuery.isError, data: groceryQuery.data},
    params.planId
  )

  const eyebrow = groceryEyebrow(view)

  // AAP 0.2.5 gives a recognised code its own recovery rather than the generic retry card. The refetch is what
  // moves the Meal Plan tab onto the plan that replaced this one; nothing navigates away from the list.
  const recoverFromStalePlan = useCallback((): void => {
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    queryClient.refetchQueries({queryKey: queryKeys.mealPlanCurrent})
  }, [queryClient])

  const onWriteFailed = useCallback(
    (error: unknown): void => {
      if (isPlanGoneCode(getApiErrorCode(error))) {
        recoverFromStalePlan()

        return
      }

      // The optimistic write has already rolled back in the mutation's own handler, so the report is all that is
      // left to do.
      showToast('error', TOAST_GENERIC_ERROR)
    },
    [recoverFromStalePlan]
  )

  // Read from the query error rather than the view, because a superseded plan is a fact about the plan even on a
  // background refetch that left decoded rows on screen. Null for a network or undecodable failure, which AAP
  // 0.2.5 answers with the inline retry card alone.
  const readErrorCode = getApiErrorCode(groceryQuery.error)
  const stalePlanReadCode = isPlanGoneCode(readErrorCode) ? readErrorCode : null

  const recoveredStalePlanCode = useRef<string | null>(null)

  useEffect(() => {
    if (stalePlanReadCode === null) {
      // Cleared so a stale-plan read that returns after a successful retry reports itself once more.
      recoveredStalePlanCode.current = null

      return
    }

    if (recoveredStalePlanCode.current === stalePlanReadCode) {
      return
    }

    recoveredStalePlanCode.current = stalePlanReadCode

    recoverFromStalePlan()
  }, [recoverFromStalePlan, stalePlanReadCode])

  const onToggleItem = useCallback(
    (item: GroceryItem): void => {
      toggleMutation.mutate({itemId: item.id, isChecked: !item.isChecked}, {onError: error => onWriteFailed(error)})
    },
    [onWriteFailed, toggleMutation]
  )

  const onUncheckAllPressed = useCallback((): void => {
    uncheckAllMutation.mutate(undefined, {onError: error => onWriteFailed(error)})
  }, [onWriteFailed, uncheckAllMutation])

  // A row is busy while its own toggle is in flight, and every row is busy while the whole list is being
  // cleared: a second press during either would write against a count the server is already changing.
  const isRowPending = (item: GroceryItem): boolean =>
    uncheckAllMutation.isPending || (toggleMutation.isPending && toggleMutation.variables?.itemId === item.id)

  const loadingBlock = (): React.JSX.Element => (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SKELETON_CARD_HEIGHTS.map((height, index) => (
        <View key={`${height}-${index}`} style={styles.skeletonRow}>
          <SkeletonBlock
            height={height}
            // Skeleton takes a number, so the card's width is computed the way ContentColumn derives it.
            width={contentColumnWidth(width)}
            borderRadius={BorderRadius.CARD_LG}
          />
        </View>
      ))}
    </View>
  )

  const errorBlock = (): React.JSX.Element => (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{MEAL_PLAN_LOAD_ERROR_TITLE}</Text>

      <TouchableOpacity
        style={styles.errorRetryPill}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onPress={() => {
          groceryQuery.refetch()
        }}>
        <Text style={styles.errorRetryLabel}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
      </TouchableOpacity>
    </View>
  )

  const noPlanBlock = (): React.JSX.Element => (
    <View style={styles.emptyStateContainer}>
      <EmptyState
        icon={<GroceryCartIcon variant="empty" color={Theme.colors.accentGreen} />}
        headline={GROCERY_NO_PLAN_TITLE}
        body={GROCERY_NO_PLAN_BODY}
        primaryLabel={MEAL_PLAN_CREATE_BUTTON_TEXT}
        onPrimary={() => navigation.navigate(Screens.MEAL_PLAN_INTRO)}
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
      />
    </View>
  )

  const blocks: GroceryBlock[] =
    view.kind === 'list'
      ? [
          ...orderGrocerySections(view.list.sections).map(
            (section, index): GroceryBlock => ({
              kind: 'category',
              key: `${CATEGORY_BLOCK_KEY_PREFIX}${section.category}`,
              label: groceryCategoryLabel(section.category),
              isFirst: index === 0,
              items: section.items
            })
          ),
          ...(view.list.checkedItems.length > 0
            ? [
                {
                  kind: 'checked',
                  key: CHECKED_BLOCK_KEY,
                  title: stringWithNamedParameters(GROCERY_CHECKED_HEADER_TEMPLATE, {n: view.list.checkedCount}),
                  items: view.list.checkedItems
                } satisfies GroceryBlock
              ]
            : [])
        ]
      : []

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

  const banner =
    view.kind === 'list' ? groceryBanner(view.list.banner, countFlaggedItems(view.list.checkedItems)) : null

  const showsUncheckAll = view.kind === 'list' && shouldShowUncheckAll(view.list.checkedCount)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        <FlatList
          data={blocks}
          keyExtractor={block => block.key}
          renderItem={renderBlock}
          contentContainerStyle={
            view.kind === 'noPlan' || view.kind === 'emptyList' ? styles.listContentEmpty : styles.listContent
          }
          ListHeaderComponent={
            <>
              <View style={styles.backRow}>
                <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

                <Text style={styles.backLabel}>{MEAL_PLAN_TITLE}</Text>
              </View>

              <Text style={styles.title}>{GROCERY_LIST_TITLE}</Text>

              {showsUncheckAll ? (
                <View style={styles.eyebrowRow}>
                  <View style={styles.headerStack}>
                    <SectionOverline text={eyebrow.text} tone={eyebrow.tone} />
                  </View>

                  <TouchableOpacity
                    style={styles.uncheckAllButton}
                    hitSlop={Spacing.SMALL}
                    accessibilityRole="button"
                    accessibilityLabel={GROCERY_UNCHECK_ALL_BUTTON_TEXT}
                    accessibilityState={{busy: uncheckAllMutation.isPending, disabled: uncheckAllMutation.isPending}}
                    disabled={uncheckAllMutation.isPending}
                    onPress={onUncheckAllPressed}>
                    <Text style={styles.uncheckAllLabel}>{GROCERY_UNCHECK_ALL_BUTTON_TEXT}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                !!eyebrow.text && (
                  <View style={styles.overlineBlock}>
                    <SectionOverline text={eyebrow.text} tone={eyebrow.tone} />
                  </View>
                )
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
