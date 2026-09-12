import {MealPlanMeal, MealPlanStatus} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative} from '@data/models/SwapAlternative'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'

import {
  MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE,
  MEAL_PLAN_MEAL_CALORIES_TEMPLATE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_SLOT_SENTENCE_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  SWAP_ALTERNATIVES_ERROR_TEXT,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_CURRENT_MEAL_LABEL,
  SWAP_CURRENT_MEAL_UNCHANGED_LABEL,
  SWAP_FAILED_BODY_TEMPLATE,
  SWAP_FAILED_TITLE,
  SWAP_NO_ALTERNATIVES_BODY_TEMPLATE,
  SWAP_STILL_YOURS_TEMPLATE,
  SWAP_TITLE_TEMPLATE
} from '@constants/strings'

export type CurrentMealCardVariant = 'default' | 'unchanged' | 'stillYours'

export interface SwapBannerContent {
  tone: 'error'
  glyph: 'alert'
  title?: string
  body: string
  actionLabel: string
  secondaryActionLabel?: string
}

export type SwapView =
  | {kind: 'loading'; currentMealVariant: 'default'}
  | {kind: 'list'; currentMealVariant: 'default'; alternatives: readonly SwapAlternative[]}
  | {kind: 'empty'; currentMealVariant: 'unchanged'}
  | {kind: 'error'; currentMealVariant: 'default'; banner: SwapBannerContent}
  | {
      kind: 'failed'
      currentMealVariant: 'stillYours'
      banner: SwapBannerContent
      alternatives: readonly SwapAlternative[]
    }
  | {kind: 'unconfirmed'; currentMealVariant: 'default'; banner: SwapBannerContent}

export type SwapViewWithAlternatives = Extract<SwapView, {alternatives: readonly SwapAlternative[]}>

export interface SwapViewInput {
  currentMeal: MealPlanMeal | null
  alternatives: readonly SwapAlternative[] | undefined
  isAlternativesPending: boolean
  alternativesError: unknown
  swapError: unknown
}

export interface MealMetaInput {
  calories: number | null | undefined
  protein: number | null | undefined
  totalMinutes: number | null | undefined
}

const META_SEPARATOR = ' \u00b7 '

const WEEKDAY_DATE_SEPARATOR = ', '

const NO_ALTERNATIVES: readonly SwapAlternative[] = Object.freeze([])

const hasError = (error: unknown): boolean => error !== null && error !== undefined

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

const isMeasurable = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value)

const slotWord = (slot: MealSlot): string => MEAL_SLOT_SENTENCE_LABELS[slot]

// The drawn assurance names the meal it left alone, so it can only be stated once that meal is known: without
// it the banner reports the failure and promises nothing about the plan or the grocery list.
const swapFailedBanner = (slot: MealSlot | null): SwapBannerContent => {
  const assurance = slot === null ? null : stringWithNamedParameters(SWAP_FAILED_BODY_TEMPLATE, {slot: slotWord(slot)})

  return {
    tone: 'error',
    glyph: 'alert',
    title: assurance === null ? undefined : SWAP_FAILED_TITLE,
    body: assurance ?? SWAP_FAILED_TITLE,
    actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
    secondaryActionLabel: SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT
  }
}

const unconfirmedOutcomeBanner = (): SwapBannerContent => ({
  tone: 'error',
  glyph: 'alert',
  title: MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  body: MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  secondaryActionLabel: SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT
})

const alternativesErrorBanner = (): SwapBannerContent => ({
  tone: 'error',
  glyph: 'alert',
  body: SWAP_ALTERNATIVES_ERROR_TEXT,
  actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
})

/**
 * Branch order is load-bearing. The commit the user just asked for is classified first, and only a confirmed
 * `swap_failed` may draw the assurance that nothing changed — an unknown outcome may have committed, so it takes
 * the neutral variant and no alternatives list, while any other confirmed code (a stale plan, an ineligible
 * recipe) falls through for the call site to report. Below that, a decoded empty array is the no-alternatives
 * state and a failed request is the retry card: absent data is never read as "nothing matches this slot".
 */
export function resolveSwapView(input: SwapViewInput): SwapView {
  const {currentMeal, alternatives, isAlternativesPending, alternativesError, swapError} = input

  if (hasError(swapError)) {
    if (isUnknownOutcome(swapError)) {
      return {kind: 'unconfirmed', currentMealVariant: 'default', banner: unconfirmedOutcomeBanner()}
    }

    if (getApiErrorCode(swapError) === API_ERROR_CODES.swapFailed) {
      return {
        kind: 'failed',
        currentMealVariant: 'stillYours',
        banner: swapFailedBanner(currentMeal?.slot ?? null),
        alternatives: alternatives ?? NO_ALTERNATIVES
      }
    }
  }

  if (isAlternativesPending || currentMeal === null) {
    return {kind: 'loading', currentMealVariant: 'default'}
  }

  if (hasError(alternativesError)) {
    return {kind: 'error', currentMealVariant: 'default', banner: alternativesErrorBanner()}
  }

  if (alternatives === undefined) {
    return {kind: 'loading', currentMealVariant: 'default'}
  }

  if (alternatives.length === 0) {
    return {kind: 'empty', currentMealVariant: 'unchanged'}
  }

  return {kind: 'list', currentMealVariant: 'default', alternatives}
}

export function rendersAlternatives(view: SwapView): view is SwapViewWithAlternatives {
  return 'alternatives' in view
}

// A status the day query has not answered yet is not an inactive plan: the flow stays available until the server
// says the plan was superseded, rather than being disabled by its own loading state.
export function isPlanInactive(planStatus: MealPlanStatus | null | undefined): boolean {
  return planStatus !== null && planStatus !== undefined && planStatus !== 'active'
}

export function isPlanRevisionStale(dayPlanRevision: number | null | undefined, openedPlanRevision: number): boolean {
  return dayPlanRevision !== null && dayPlanRevision !== undefined && dayPlanRevision !== openedPlanRevision
}

export function buildSwapTitle(slot: MealSlot): string {
  return stringWithNamedParameters(SWAP_TITLE_TEMPLATE, {slot: slotWord(slot)})
}

export function currentMealEyebrow(variant: CurrentMealCardVariant, slot: MealSlot): string {
  if (variant === 'unchanged') {
    return SWAP_CURRENT_MEAL_UNCHANGED_LABEL
  }

  if (variant === 'stillYours') {
    return stringWithNamedParameters(SWAP_STILL_YOURS_TEMPLATE, {slot: slotWord(slot)})
  }

  return SWAP_CURRENT_MEAL_LABEL
}

export function buildNoAlternativesBody(slot: MealSlot): string {
  return stringWithNamedParameters(SWAP_NO_ALTERNATIVES_BODY_TEMPLATE, {slot: slotWord(slot)})
}

export function buildSwapDateLabel(dayKey: string): string {
  const {weekday} = dayStripLabel(dayKey)

  return `${weekday}${WEEKDAY_DATE_SEPARATOR}${formatPlanDayLabel(dayKey)}`
}

// One composer for the alternative rows and the current-meal card, so a figure the user compares across the two
// can never be formatted two ways. A value the response left out drops its whole segment, separator included.
export function buildMealMetaText(meta: MealMetaInput): string {
  const segments = [
    isMeasurable(meta.calories)
      ? stringWithNamedParameters(MEAL_PLAN_MEAL_CALORIES_TEMPLATE, {calories: formatCalories(meta.calories)})
      : undefined,
    isMeasurable(meta.protein) ? `${formatMacroGrams(meta.protein)} ${PROTEIN_LABEL}` : undefined,
    isMeasurable(meta.totalMinutes)
      ? stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE, {minutes: Math.round(meta.totalMinutes)})
      : undefined
  ]

  return segments.filter(isPresent).join(META_SEPARATOR)
}

export interface SkeletonAlternativeRow {
  primary: number
  secondary: number
}

// Frame 13c sizes each placeholder bar as a fraction of its row's fill-width text column, so the card matches
// the design on every device rather than only at the 393px reference: Figma's 193.68/129.12, 156.02/107.59 and
// 177.54/139.88 over a 269px column (321px card interior less the 40px tile and the 12px gap), which is 251px
// on a 375px device. They live here rather than in index.styled.ts because they are layout ratios rather than
// design tokens, and a stylesheet may carry no numeric literal.
export const SKELETON_ALTERNATIVE_ROWS: ReadonlyArray<SkeletonAlternativeRow> = [
  {primary: 0.72, secondary: 0.48},
  {primary: 0.58, secondary: 0.4},
  {primary: 0.66, secondary: 0.52}
]

export function skeletonBarWidth(textColumnWidth: number, widthProportion: number): number {
  return textColumnWidth > 0 ? Math.round(textColumnWidth * widthProportion) : 0
}
