import React from 'react'

import {FlatList, ListRenderItemInfo, TouchableOpacity, useWindowDimensions, View} from 'react-native'

import type {GroceryItem} from '@data/models/GroceryList'
import {GroceryListRouteProp, Navigation} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useGroceryListQuery} from '@queries/mealPlanning/useGroceryListQuery'
import {useToggleGroceryItemMutation} from '@queries/mealPlanning/useToggleGroceryItemMutation'
import {useUncheckAllGroceriesMutation} from '@queries/mealPlanning/useUncheckAllGroceriesMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
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
  GroceryView,
  orderCheckedItems,
  orderGrocerySections,
  resolveGroceryView,
  shouldShowUncheckAll
} from './index.util'

// 13c's skeleton vocabulary, shaped like the loaded screen: a section label, then a card per aisle it stands in for.
const SKELETON_BLOCKS: ReadonlyArray<{height: number; borderRadius: number}> = [
  {height: Sizes.SKELETON_BAR, borderRadius: BorderRadius.CHECKBOX},
  {height: Sizes.CONTROL_LG, borderRadius: BorderRadius.CARD_LG},
  {height: Sizes.CONTROL_LG, borderRadius: BorderRadius.CARD_LG}
]

// The route may carry no plan while the current one is still being read, and 14c would then claim "no active
// plan" about a plan that is about to arrive. Held as a constant so the guard allocates nothing per render.
const PLAN_RESOLVING_VIEW: GroceryView = {kind: 'loading'}

// Both write hooks are scoped to a plan, and this screen can open without one (14c). The empty id is never
// sent: every control that fires them renders only inside a decoded list, which exists only for a real plan.
const NO_PLAN_ID = ''

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

  const currentPlanQuery = useCurrentMealPlanQuery()

  // Opening the list without a plan id means "shop the plan I am on", so the current plan answers for it. AAP
  // 0.7.4 treats a missing id and an absent current plan as the one no-plan state, which this resolves to null.
  const planId = params.planId ?? currentPlanQuery.data?.current?.id ?? null

  const groceryQuery = useGroceryListQuery(planId)
  const toggleMutation = useToggleGroceryItemMutation(planId ?? NO_PLAN_ID)
  const uncheckAllMutation = useUncheckAllGroceriesMutation(planId ?? NO_PLAN_ID)

  const isResolvingPlan = params.planId === null && currentPlanQuery.isLoading

  const view: GroceryView = isResolvingPlan
    ? PLAN_RESOLVING_VIEW
    : resolveGroceryView(
        {isLoading: groceryQuery.isLoading, isError: groceryQuery.isError, data: groceryQuery.data},
        planId
      )

  const eyebrow = groceryEyebrow(view)

  // Both writes are optimistic and both roll themselves back, so a rejection leaves this screen nothing to undo
  // and nothing to invalidate: reporting it is the whole job, and the row is already back where it was.
  const onToggleItem = async (item: GroceryItem): Promise<void> => {
    try {
      await toggleMutation.mutateAsync({itemId: item.id, isChecked: !item.isChecked})
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  const onUncheckAllPressed = async (): Promise<void> => {
    try {
      await uncheckAllMutation.mutateAsync()
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

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
                  items: orderCheckedItems(view.list.checkedItems)
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
