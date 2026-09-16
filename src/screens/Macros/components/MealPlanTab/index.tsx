import React, {ReactNode, useCallback, useEffect, useRef, useState} from 'react'

import {LayoutChangeEvent, TouchableOpacity, View} from 'react-native'

import {MealPlan, MealPlanDay, MealPlanMeal} from '@data/models/MealPlan'
import {useMealPlanEntitlement} from '@hooks/mealPlanning/useMealPlanEntitlement'
import {Navigation} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {ParamListBase, useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {useSessionStore} from '@store/session/useSessionStore'
import BorderRadius from '@styles/borderRadius'
import FontSize, {LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {getApiErrorCode} from '@utility/ApiErrorUtility'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import {
  addDaysToDayKey,
  formatPlanDayLabel,
  formatPlanRange,
  parseDayKey,
  planDates
} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroPair} from '@utility/NutritionFormatUtility'

import InfoBanner from '@components/InfoBanner'
import SectionOverline from '@components/SectionOverline'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MACROS_TITLE,
  MEAL_PLAN_DAY_TARGET_TEMPLATE,
  MEAL_PLAN_EMPTY_BODY,
  MEAL_PLAN_EMPTY_TITLE,
  MEAL_PLAN_GO_TO_DIARY_BUTTON_TEXT,
  MEAL_PLAN_LAST_DAY_TITLE,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MEAL_COUNT_TEMPLATE,
  MEAL_PLAN_NEXT_WEEK_LINK_TEXT,
  MEAL_PLAN_OFFLINE_BANNER_TEXT,
  MEAL_PLAN_PLAN_ANOTHER_WEEK_BUTTON_TEXT,
  MEAL_PLAN_PLANNED_FOR_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TARGETS_STALE_CAPTION,
  MEAL_PLAN_THIS_WEEK_LINK_TEXT,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNAVAILABLE_TEXT,
  MEAL_PLAN_VIEW_DIARY_LINK_TEXT,
  MEAL_PLAN_VIEW_NEXT_WEEK_BUTTON_TEXT,
  PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import DayStrip from './components/DayStrip'
import EmptyPlanState from './components/EmptyPlanState'
import LastDayCard from './components/LastDayCard'
import MealPlanCard from './components/MealPlanCard'
import PlanHeader from './components/PlanHeader'
import PlannedTotalsCard from './components/PlannedTotalsCard'
import PlanSettingsRow from './components/PlanSettingsRow'
import styles from './index.styled'
import {
  arePlanActionsOffered,
  EmptyPlanCta,
  flexItemWidth,
  formatPostLogBannerBody,
  isStalePlanCode,
  LastDayAction,
  MealLoggedState,
  planDayWeekdayName,
  PlanSwitchLink,
  resolveEmptyPlanCtaLabel,
  resolveLastDayAction,
  resolveMealLoggedState,
  resolveMealPlanBody,
  resolvePlanSwitchLink,
  resolveSelectedPlanDate,
  resolveSetupResumeTarget,
  resolveStalePlanSelection,
  resolveViewTarget,
  SetupResumeTarget
} from './index.util'

// The day query is scoped to a plan and this tab renders four states that have none. The empty id is never
// sent: it is paired with the disabled gate below, so no request is issued without a plan to read.
const NO_PLAN_ID = ''

const NEXT_WEEK_OFFSET_DAYS = 1

// A placeholder stands in for content whose length it cannot know, so each bar takes a share of the measured
// column rather than a width of its own.
const SKELETON_OVERLINE_WIDTH_RATIO = 0.4

const SKELETON_TITLE_WIDTH_RATIO = 0.6

const SKELETON_LABEL_WIDTH_RATIO = 0.5

const SKELETON_VALUE_WIDTH_RATIO = 0.25

const SKELETON_TOTALS_ROW_KEYS: number[] = [0, 1, 2]

const SKELETON_MEAL_ROW_KEYS: number[] = [0, 1]

const SKELETON_MEAL_CARD_KEYS: number[] = [0, 1]

// A placeholder card carries the gutter padding on both of its sides, which its bars sit inside.
const CARD_INSET_SIDES = 2

// A text link is shorter than the smallest comfortable target, so the difference is made up around it.
const PLAN_SWITCH_HIT_SLOP = Math.ceil((Sizes.TOUCH_TARGET - FontSize.LABEL) / 2)

const RETRY_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

interface Props {
  segmentedControl: ReactNode
}

/**
 * Frames 11c, 11 and 11b: the Meal Plan segment of the Macros screen, from the week that does not exist yet
 * through the plan and its logged meal.
 *
 * The header is this component's decision rather than the parent's, because which of the three it is follows
 * the plan state that only the queries here can answer: the empty and error states keep the Macros header the
 * screen already had, a plan replaces it with its own range-and-grocery header, and the first load shows
 * neither. The segmented control is handed in so exactly one exists whichever segment is on screen.
 */
const MealPlanTab = ({segmentedControl}: Props): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()

  const {availability, isGatedRequestAllowed} = useMealPlanEntitlement()
  // The session's day key, not the clock: it is the app's own 'today', re-evaluated on every foreground, and it
  // is what makes the plan rollover refetch fire. It is never written from here.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)

  // Gated on the same flag the entitlement hook reads, so these observers share its query instances instead of
  // splitting each read into two with conflicting enablement.
  const preferencesQuery = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const currentPlanQuery = useCurrentMealPlanQuery(isGatedRequestAllowed, sessionDayKey)

  const selectedPlanId = useMealPlanStore(state => state.selectedPlanId)
  const selectedPlanDate = useMealPlanStore(state => state.selectedPlanDate)
  const postLogResult = useMealPlanStore(state => state.postLogResult)
  const dismissedSuccessBannerFor = useMealPlanStore(state => state.dismissedSuccessBannerFor)
  const setSelectedPlanId = useMealPlanStore(state => state.setSelectedPlanId)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  const dismissSuccessBanner = useMealPlanStore(state => state.dismissSuccessBanner)
  const clearPostLogResult = useMealPlanStore(state => state.clearPostLogResult)

  const [skeletonWidth, setSkeletonWidth] = useState(0)

  const plans = currentPlanQuery.data
  const outcome = resolveMealPlanBody({
    availability,
    preferences: preferencesQuery.data,
    preferencesError: preferencesQuery.error,
    plans,
    currentPlanError: currentPlanQuery.error,
    isLoading: preferencesQuery.isLoading || currentPlanQuery.isLoading,
    selectedPlanId
  })

  // Taken from the outcome rather than resolved a second time, so the plan the body renders and the plan the
  // day query, the header and every route parameter are built from cannot diverge.
  const plan = outcome.kind === 'plan' ? outcome.plan : null
  const selectedDayKey =
    plan === null ? sessionDayKey : resolveSelectedPlanDate(plan, selectedPlanDate, parseDayKey(sessionDayKey))

  const dayQuery = useMealPlanDayQuery(plan?.id ?? NO_PLAN_ID, selectedDayKey, plan !== null && isGatedRequestAllowed)

  const envelope = dayQuery.data ?? null
  // The day route is the fresher read — its meals carry the logged entries and its envelope the write verdict —
  // and the plan's own day stands in for it until it answers, so switching days never empties the screen.
  const day: MealPlanDay | null =
    envelope?.day ?? plan?.days.find(candidate => candidate.date === selectedDayKey) ?? null

  const areActionsOffered = arePlanActionsOffered(outcome, envelope?.isWritable)
  // The refusal itself, as opposed to a verdict that has not arrived or a plan restored from the cache: only
  // this one has something true to tell the user when a control is pressed.
  const isWriteRefused = envelope?.isWritable === false

  const planSwitchLink = plan === null ? null : resolvePlanSwitchLink(plans, selectedPlanId)
  const lastDayAction = plan === null ? null : resolveLastDayAction(plans, selectedPlanId, selectedDayKey)

  const isSuccessBannerVisible = postLogResult !== null && postLogResult.entryId !== dismissedSuccessBannerFor

  // Read from the query errors rather than from the body outcome, because a superseded plan is a fact about the
  // plan even on a background refetch that left a readable week on screen. Null for a network or undecodable
  // failure, which is answered by the inline retry card alone.
  const readErrorCode =
    getApiErrorCode(currentPlanQuery.error) ??
    getApiErrorCode(preferencesQuery.error) ??
    getApiErrorCode(dayQuery.error)
  const stalePlanReadCode = isStalePlanCode(readErrorCode) ? readErrorCode : null

  const refetchCurrentPlan = currentPlanQuery.refetch

  const recoverFromStalePlan = useCallback((): void => {
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [refetchCurrentPlan])

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

  useEffect(() => {
    const resolvedPlanId = resolveStalePlanSelection(plans, selectedPlanId)

    if (resolvedPlanId !== selectedPlanId) {
      setSelectedPlanId(resolvedPlanId)
    }
  }, [plans, selectedPlanId, setSelectedPlanId])

  const bannerContext = useRef<string | null>(null)

  /**
   * AAP 0.1.4 (iii): the success banner stands where the totals card does until the user reads the entry, moves
   * to another day or plan, or leaves this segment. The day and plan it was raised against are held here
   * because the store records neither, and nothing re-raises it — only another log does.
   */
  useEffect(() => {
    if (postLogResult === null) {
      bannerContext.current = null

      return
    }

    const context = `${selectedPlanId ?? NO_PLAN_ID}|${selectedDayKey}`

    if (bannerContext.current === null) {
      bannerContext.current = context

      return
    }

    if (bannerContext.current !== context) {
      clearPostLogResult()
    }
  }, [clearPostLogResult, postLogResult, selectedDayKey, selectedPlanId])

  // Leaving the segment unmounts this tab, which is the third of the three ways the banner is dismissed.
  useEffect(() => clearPostLogResult, [clearPostLogResult])

  const onSkeletonLayout = (event: LayoutChangeEvent): void => setSkeletonWidth(event.nativeEvent.layout.width)

  const openSetupResumeTarget = (target: SetupResumeTarget): void => {
    // Route and params arrive correlated from the util, and the runtime navigation object takes the pair as it
    // stands rather than re-deriving the pairing — the same dispatch the tab-return actions use.
    const stack: NativeStackNavigationProp<ParamListBase> = navigation

    stack.navigate<string>(target.route, target.params)
  }

  const onEmptyPrimaryPressed = (cta: EmptyPlanCta): void => {
    if (cta === 'create') {
      navigation.navigate(Screens.MEAL_PLAN_INTRO)

      return
    }

    if (cta === 'continueSetupStep') {
      // Resuming opens the saved step itself, so a returning user never meets the introduction again.
      openSetupResumeTarget(resolveSetupResumeTarget(preferencesQuery.data?.setupStep ?? null))

      return
    }

    if (cta === 'continueSetupReview') {
      navigation.navigate(Screens.MEAL_PLAN_TARGETS, {mode: 'setup'})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_TARGETS, {mode: 'nextWeek', startDate: sessionDayKey})
  }

  const onGoToDiaryPressed = (): void => setMacrosSegment('diary')

  const onGroceryPressed = (): void => {
    if (plan === null) {
      return
    }

    navigation.navigate(Screens.GROCERY_LIST, {planId: plan.id})
  }

  const onPlanSettingsPressed = (): void => {
    if (plan === null) {
      return
    }

    navigation.navigate(Screens.PLAN_SETTINGS, {planId: plan.id})
  }

  const onPlanSwitchPressed = (link: PlanSwitchLink): void => {
    const target = link === 'next' ? plans?.upcoming : plans?.current

    if (target === null || target === undefined) {
      return
    }

    setSelectedPlanId(target.id)
  }

  const onLastDayActionPressed = (action: LastDayAction): void => {
    if (plan === null) {
      return
    }

    if (action === 'viewNextWeek') {
      const upcoming = plans?.upcoming ?? null

      if (upcoming !== null) {
        setSelectedPlanId(upcoming.id)
      }

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_TARGETS, {
      mode: 'nextWeek',
      startDate: addDaysToDayKey(plan.endDate, NEXT_WEEK_OFFSET_DAYS)
    })
  }

  const onOpenRecipePressed = (meal: MealPlanMeal): void => {
    if (plan === null) {
      return
    }

    navigation.navigate(Screens.RECIPE_DETAIL, {
      recipeVersionId: meal.recipe.versionId,
      context: {kind: 'plan', planId: plan.id, mealId: meal.id, date: selectedDayKey}
    })
  }

  /**
   * Swap and Log are always drawn, so the press decides what it does: a plan the server has superseded — or a
   * week that has finished, which storage still calls active — gets the stale-plan toast and a refetch rather
   * than two controls that quietly do nothing.
   *
   * A verdict that has not arrived, and a week restored read-only from the cache, are not that refusal and say
   * nothing: reporting either would tell a user whose plan is live that it is no longer active.
   */
  const onWriteActionPressed = (
    route: typeof Screens.LOG_PLANNED_MEAL | typeof Screens.SWAP_MEAL,
    meal: MealPlanMeal
  ): void => {
    if (plan === null || envelope === null) {
      return
    }

    if (!areActionsOffered) {
      if (isWriteRefused) {
        recoverFromStalePlan()
      }

      return
    }

    const routeParams = {
      planId: plan.id,
      mealId: meal.id,
      date: selectedDayKey,
      // The revision the day was read at, which is what the destination pins its write to.
      planRevision: envelope.planRevision
    }

    if (route === Screens.SWAP_MEAL) {
      navigation.navigate(Screens.SWAP_MEAL, routeParams)

      return
    }

    navigation.navigate(Screens.LOG_PLANNED_MEAL, routeParams)
  }

  /**
   * The diary the logged meal went to. Today's entry is in the Diary segment, so switching to it is the whole
   * answer — no row is scrolled to or highlighted; any other date is in Macros History, which already lists
   * every day that has entries.
   */
  const onViewDiaryPressed = (loggedState: MealLoggedState): void => {
    if (loggedState.kind === 'unlogged') {
      return
    }

    if (resolveViewTarget(loggedState.entry.date, sessionDayKey) === 'diary') {
      setMacrosSegment('diary')

      return
    }

    navigation.navigate(Screens.MACROS_HISTORY)
  }

  const onBannerViewDiaryPressed = (): void => {
    if (postLogResult === null) {
      return
    }

    dismissSuccessBanner(postLogResult.entryId)

    // The target was decided when the entry was written, against the date it was written to.
    if (postLogResult.viewTarget === 'diary') {
      setMacrosSegment('diary')

      return
    }

    navigation.navigate(Screens.MACROS_HISTORY)
  }

  const skeletonHeaderBlock = (): React.JSX.Element => (
    <View style={styles.skeletonHeaderRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {skeletonWidth > 0 && (
        <>
          <SkeletonBlock
            height={Sizes.SKELETON_BAR_SM}
            // Skeleton takes a number and sizes its shimmer sweep from it, so the measured column width is what
            // the animation has to match.
            width={skeletonWidth * SKELETON_OVERLINE_WIDTH_RATIO}
            borderRadius={BorderRadius.BAR}
          />

          <SkeletonBlock
            height={LineHeight.SCREEN_TITLE}
            width={skeletonWidth * SKELETON_TITLE_WIDTH_RATIO}
            borderRadius={BorderRadius.TILE}
          />
        </>
      )}
    </View>
  )

  const macrosHeaderBlock = (): React.JSX.Element => (
    <View style={styles.macrosHeader}>
      <SectionOverline text={formatIsoDayMonthDay(sessionDayKey)} tone="green" />

      <Text style={styles.screenTitle}>{MACROS_TITLE}</Text>
    </View>
  )

  const headerBlock = (): React.JSX.Element => {
    if (outcome.kind === 'plan') {
      return (
        <PlanHeader
          rangeText={formatPlanRange(outcome.plan.startDate, outcome.plan.endDate)}
          onGroceryPressed={onGroceryPressed}
        />
      )
    }

    if (outcome.kind === 'loading') {
      return skeletonHeaderBlock()
    }

    return macrosHeaderBlock()
  }

  // Figma draws no switch between a current and an upcoming plan: the week on screen is named by the header, so
  // the other one is offered as a link beside it (AAP 0.7.4).
  const planSwitchBlock = (link: PlanSwitchLink): React.JSX.Element => (
    <View style={styles.planSwitchRow}>
      <TouchableOpacity
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={link === 'next' ? MEAL_PLAN_NEXT_WEEK_LINK_TEXT : MEAL_PLAN_THIS_WEEK_LINK_TEXT}
        hitSlop={PLAN_SWITCH_HIT_SLOP}
        onPress={() => onPlanSwitchPressed(link)}>
        <Text style={styles.planSwitchLink}>
          {link === 'next' ? MEAL_PLAN_NEXT_WEEK_LINK_TEXT : MEAL_PLAN_THIS_WEEK_LINK_TEXT}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const skeletonCardBlock = (cardKey: string, rowKeys: number[]): React.JSX.Element => {
    const innerWidth = skeletonWidth - Spacing.GUTTER * CARD_INSET_SIDES

    return (
      <View key={cardKey} style={styles.skeletonCard}>
        {rowKeys.map(rowKey => (
          <View key={rowKey} style={styles.skeletonRow}>
            <SkeletonBlock
              height={Sizes.SKELETON_BAR}
              width={innerWidth * SKELETON_LABEL_WIDTH_RATIO}
              borderRadius={BorderRadius.BAR}
            />

            <SkeletonBlock
              height={Sizes.SKELETON_BAR_SM}
              width={innerWidth * SKELETON_VALUE_WIDTH_RATIO}
              borderRadius={BorderRadius.BAR}
            />
          </View>
        ))}
      </View>
    )
  }

  // Shaped like the plan it stands in for — the week's day strip, its totals and two of its meals — so the
  // first answer lands in a layout the eye has already settled on (AAP 0.2.5).
  const loadingBlock = (): React.JSX.Element => {
    // Keyed by the dates this session would ask for, since the placeholder cannot know the week it stands in
    // for and a positional key would re-order the shimmer when the real strip arrives.
    const skeletonDayKeys = planDates(sessionDayKey)

    return (
      <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
        {skeletonWidth > 0 && (
          <>
            <View style={styles.skeletonDayStrip}>
              {skeletonDayKeys.map(dayKey => (
                <SkeletonBlock
                  key={dayKey}
                  height={Sizes.CONTROL_LG}
                  width={flexItemWidth(skeletonWidth, Spacing.TIGHT, skeletonDayKeys.length)}
                  borderRadius={BorderRadius.TILE}
                />
              ))}
            </View>

            {skeletonCardBlock('totals', SKELETON_TOTALS_ROW_KEYS)}

            {SKELETON_MEAL_CARD_KEYS.map(cardKey => skeletonCardBlock(`meal-${cardKey}`, SKELETON_MEAL_ROW_KEYS))}
          </>
        )}
      </View>
    )
  }

  // A failure that leaves nothing to read is reported where the week would have been, never as the no-plan
  // state: claiming the user has no plan because a request failed is the one answer that is always wrong.
  const errorBlock = (): React.JSX.Element => (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{MEAL_PLAN_LOAD_ERROR_TITLE}</Text>

      <TouchableOpacity
        style={styles.retryPill}
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        hitSlop={RETRY_PILL_HIT_SLOP}
        onPress={() => {
          preferencesQuery.refetch()
          refetchCurrentPlan()
        }}>
        <Text style={styles.retryLabel}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
      </TouchableOpacity>
    </View>
  )

  // No call to action: the feature is switched off or the routes are gone, and nothing the user can press here
  // would change either (AAP 0.2.5).
  const unavailableBlock = (): React.JSX.Element => (
    <View style={styles.unavailableCard}>
      <Text style={styles.unavailableText}>{MEAL_PLAN_UNAVAILABLE_TEXT}</Text>
    </View>
  )

  const emptyBlock = (cta: EmptyPlanCta): React.JSX.Element => (
    <EmptyPlanState
      headline={MEAL_PLAN_EMPTY_TITLE}
      body={MEAL_PLAN_EMPTY_BODY}
      primaryLabel={resolveEmptyPlanCtaLabel(cta)}
      onPrimary={() => onEmptyPrimaryPressed(cta)}
      secondaryLabel={MEAL_PLAN_GO_TO_DIARY_BUTTON_TEXT}
      onSecondary={onGoToDiaryPressed}
    />
  )

  const successBannerBlock = (result: NonNullable<typeof postLogResult>): React.JSX.Element => (
    <View style={styles.bannerContainer}>
      <InfoBanner
        tone="success"
        glyph="disc"
        body={formatPostLogBannerBody(result.dateIso, result.slotLabel, sessionDayKey)}
        actionLabel={MEAL_PLAN_VIEW_DIARY_LINK_TEXT}
        onAction={onBannerViewDiaryPressed}
      />
    </View>
  )

  const totalsBlock = (activePlan: MealPlan, plannedDay: MealPlanDay): React.JSX.Element => (
    <View style={styles.totalsCardContainer}>
      <PlannedTotalsCard
        dayName={stringWithNamedParameters(MEAL_PLAN_PLANNED_FOR_TEMPLATE, {
          day: planDayWeekdayName(plannedDay.date)
        })}
        targetText={stringWithNamedParameters(MEAL_PLAN_DAY_TARGET_TEMPLATE, {
          calories: formatCalories(activePlan.targets.calories)
        })}
        figure={formatCalories(plannedDay.plannedTotals.calories)}
        unitText={stringWithNamedParameters(MEAL_PLAN_MEAL_COUNT_TEMPLATE, {n: plannedDay.meals.length})}
        legend={[
          {
            label: MEAL_PLAN_MACRO_LABELS.protein,
            valueText: formatMacroPair(plannedDay.plannedTotals.protein, activePlan.targets.protein),
            dotColor: Theme.colors.accentGreen
          },
          {
            label: MEAL_PLAN_MACRO_LABELS.carbs,
            valueText: formatMacroPair(plannedDay.plannedTotals.carbs, activePlan.targets.carbs),
            dotColor: Theme.colors.teal
          },
          {
            label: MEAL_PLAN_MACRO_LABELS.fat,
            valueText: formatMacroPair(plannedDay.plannedTotals.fat, activePlan.targets.fat),
            dotColor: Theme.colors.lime
          }
        ]}
      />

      {/* A plan outliving the targets it was built against says so and changes nothing on its own (AAP 0.2.5). */}
      {activePlan.targetsStale && (
        <View style={styles.captionContainer}>
          <Text style={styles.staleCaption}>{MEAL_PLAN_TARGETS_STALE_CAPTION}</Text>
        </View>
      )}
    </View>
  )

  const mealCardsBlock = (plannedDay: MealPlanDay): React.JSX.Element[] =>
    plannedDay.meals.map((meal, index) => {
      const loggedState = resolveMealLoggedState(meal)

      return (
        <View key={meal.id} style={index === 0 ? styles.mealCardContainerFirst : styles.mealCardContainer}>
          <MealPlanCard
            meal={meal}
            loggedState={loggedState}
            onOpen={() => onOpenRecipePressed(meal)}
            onSwap={() => onWriteActionPressed(Screens.SWAP_MEAL, meal)}
            onLog={() => onWriteActionPressed(Screens.LOG_PLANNED_MEAL, meal)}
            onViewDiary={() => onViewDiaryPressed(loggedState)}
          />
        </View>
      )
    })

  const lastDayBlock = (activePlan: MealPlan, action: LastDayAction): React.JSX.Element => (
    <View style={styles.lastDayCardContainer}>
      <LastDayCard
        title={MEAL_PLAN_LAST_DAY_TITLE}
        rangeText={stringWithNamedParameters(PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE, {
          start: formatPlanDayLabel(activePlan.startDate),
          end: formatPlanDayLabel(activePlan.endDate)
        })}
        action={{
          label:
            action === 'viewNextWeek' ? MEAL_PLAN_VIEW_NEXT_WEEK_BUTTON_TEXT : MEAL_PLAN_PLAN_ANOTHER_WEEK_BUTTON_TEXT,
          onPress: () => onLastDayActionPressed(action)
        }}
      />
    </View>
  )

  const planBlock = (activePlan: MealPlan, isSavedCopy: boolean): React.JSX.Element => (
    <>
      {/* The week is the one persisted read, so a failing refresh leaves it on screen and says which it is. */}
      {isSavedCopy && (
        <View style={styles.bannerContainer}>
          <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_OFFLINE_BANNER_TEXT} />
        </View>
      )}

      <View style={styles.dayStripContainer}>
        <DayStrip
          dayKeys={planDates(activePlan.startDate)}
          selectedDayKey={selectedDayKey}
          onDayPressed={setSelectedPlanDate}
        />
      </View>

      {isSuccessBannerVisible && postLogResult !== null
        ? successBannerBlock(postLogResult)
        : day !== null && totalsBlock(activePlan, day)}

      {day !== null && mealCardsBlock(day)}

      {lastDayAction !== null && lastDayBlock(activePlan, lastDayAction)}

      {/* Figma gives the plan header one action, the grocery list, so the settings screen is reached from the
          foot of every plan day instead (AAP 0.1.4). */}
      <View style={styles.planSettingsRowContainer}>
        <PlanSettingsRow onPress={onPlanSettingsPressed} />
      </View>
    </>
  )

  const bodyBlock = (): React.JSX.Element => {
    if (outcome.kind === 'unavailable') {
      return unavailableBlock()
    }

    if (outcome.kind === 'loading') {
      return loadingBlock()
    }

    if (outcome.kind === 'error') {
      return errorBlock()
    }

    if (outcome.kind === 'empty') {
      return emptyBlock(outcome.cta)
    }

    return planBlock(outcome.plan, outcome.isSavedCopy)
  }

  return (
    <View style={styles.body} onLayout={onSkeletonLayout}>
      {headerBlock()}

      {segmentedControl}

      {planSwitchLink !== null && planSwitchBlock(planSwitchLink)}

      {bodyBlock()}
    </View>
  )
}

export default MealPlanTab
