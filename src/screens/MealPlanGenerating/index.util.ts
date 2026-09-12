import type {MealPlanPreferences, SetupStep} from '@data/models/MealPlanPreferences'
import type {NutritionTargets} from '@data/models/NutritionTargets'
import type {LimitingConstraint, LimitingConstraintKey, LimitingConstraintUnit} from '@data/models/PlanGenerationResult'
import type {GenerationContext} from '@navigation/types'
import {API_ERROR_CODES, classifyOutcome, getApiErrorCode} from '@utility/ApiErrorUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'

import type {StatusBadgeVariant} from '@components/StatusBadgeCircle'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ALLERGIES_ROW_LABEL,
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR,
  MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES,
  MEAL_PLAN_COOKING_TIME_MAX_TEMPLATE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DIET_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT,
  MEAL_PLAN_GENERATING_BODY,
  MEAL_PLAN_GENERATING_COOKING_TIME_LABEL,
  MEAL_PLAN_GENERATING_MEALS_PER_DAY_LABEL,
  MEAL_PLAN_GENERATING_SUMMARY_HEADER,
  MEAL_PLAN_GENERATING_TITLE,
  MEAL_PLAN_GENERATION_FAILED_BODY,
  MEAL_PLAN_GENERATION_FAILED_TITLE,
  MEAL_PLAN_GENERATION_TERMINAL_COPY,
  MEAL_PLAN_LIMITING_CONSTRAINT_LABELS,
  MEAL_PLAN_MEALS_PER_DAY_VALUES,
  MEAL_PLAN_NO_MATCH_BODY,
  MEAL_PLAN_NO_MATCH_TITLE,
  MEAL_PLAN_SAVED_ANSWERS_HEADER,
  MEAL_PLAN_SELECTED_VALUE_TEMPLATE,
  MEAL_PLAN_TARGETS_KCAL_TEMPLATE,
  MEAL_PLAN_TARGETS_ROW_LABEL,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_SLOT_LABELS,
  stringWithNamedParameters,
  TerminalOutcomeCopy
} from '@constants/strings'

export type GenerationViewKind = 'pending' | 'failed' | 'noMatch' | 'unconfirmed' | 'terminal'

// The four members of TanStack's mutation status, declared here so the screen can pass mutation.status
// straight in while this module stays free of any library coupling.
export type GenerationRequestStatus = 'idle' | 'pending' | 'error' | 'success'

export type GenerationActionKind = 'retry' | 'editPreferences' | 'backToPlan'

export type GenerationHeadlineSize = 'default' | 'alternate'

export type ConstraintEditReturnTo = 'review' | 'settings'

export interface GenerationAction {
  kind: GenerationActionKind
  label: string
}

export interface GenerationActionPair {
  primary: GenerationAction
  secondary: GenerationAction
}

export interface GenerationSummaryRow {
  label: string
  value: string
}

export interface GenerationSummary {
  overline: string
  rows: GenerationSummaryRow[]
}

export interface LimitingConstraintRow {
  constraintKey: LimitingConstraintKey
  label: string
  value: string
  editStep: SetupStep
  editLabel: string
  editAccessibilityLabel: string
}

export interface GenerationView {
  kind: GenerationViewKind
  isCentered: boolean
  showSpinner: boolean
  badgeVariant: StatusBadgeVariant | null
  headline: string
  headlineSize: GenerationHeadlineSize
  body: string
  showAllergiesBanner: boolean
  actions: GenerationActionPair | null
  terminalCode: string | null
}

const NO_VALUE = ''

// Must stay identical to the sentinel MealPlanSetupProvider and MealPlanDiet own: 'none' is mutually
// exclusive with the named allergies, so it is a selection to exclude from the count rather than one of
// them. It is re-declared rather than imported because a helper may not cross a component folder.
const ALLERGEN_NONE = 'none'

// Outcomes a same-key retry can never resolve: the request was refused for a reason only a fresh
// decision elsewhere can clear, so they get their own copy and no retry action.
const TERMINAL_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.staleRevision,
  API_ERROR_CODES.planOverlap,
  API_ERROR_CODES.upcomingExists,
  API_ERROR_CODES.preferencesIncomplete,
  API_ERROR_CODES.targetsMissing,
  API_ERROR_CODES.targetsUnconfirmed,
  API_ERROR_CODES.idempotencyConflict
])

const CONSTRAINT_KEYS: readonly LimitingConstraintKey[] = [
  'cooking_time',
  'dislikes',
  'diet',
  'nutrition_tolerance',
  'portion_limits',
  'slot_coverage',
  'catalog_coverage'
]

const CONSTRAINT_UNITS: readonly LimitingConstraintUnit[] = ['minutes', 'foods', 'percent', 'recipes']

// Record<string, string> indexing types as string, so both maps are read through a widened alias to keep
// the unknown-key branch reachable: a slot or terminal code from a newer server release must never be
// rendered raw, and an absent entry must fall through rather than reach a formatter as undefined.
const SLOT_LABELS: Record<string, string | undefined> = MEAL_SLOT_LABELS

const TERMINAL_COPY: Record<string, TerminalOutcomeCopy | undefined> = MEAL_PLAN_GENERATION_TERMINAL_COPY

const CONSTRAINT_EDIT_ROUTES: Record<SetupStep, string> = {
  goal: Screens.MEAL_PLAN_GOAL,
  body: Screens.MEAL_PLAN_TARGETS,
  activity: Screens.MEAL_PLAN_TARGETS,
  diet: Screens.MEAL_PLAN_DIET,
  dislikes: Screens.MEAL_PLAN_FOOD_PREFERENCES,
  schedule: Screens.MEAL_PLAN_SCHEDULE,
  cooking: Screens.MEAL_PLAN_COOKING_BUDGET,
  review: Screens.MEAL_PLAN_TARGETS,
  targets_manual: Screens.MEAL_PLAN_TARGETS
}

const ACTION_LABELS: Record<GenerationActionKind, string> = {
  retry: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  editPreferences: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT,
  backToPlan: MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT
}

interface GenerationViewChrome {
  isCentered: boolean
  showSpinner: boolean
  badgeVariant: StatusBadgeVariant | null
  headlineSize: GenerationHeadlineSize
  showAllergiesBanner: boolean
}

// A Record over the kind union rather than a switch: the compiler requires an entry per kind, so a new
// state cannot ship without its chrome. 'noMatch' carries the unconfirmed badge too because it is the
// only 64px disc StatusBadgeCircle fills neutrally and the component offers no fill override — the
// 'failure' badge asserts a confirmed failure that an unconfirmed outcome has not observed.
const VIEW_CHROME: Record<GenerationViewKind, GenerationViewChrome> = {
  pending: {
    isCentered: true,
    showSpinner: true,
    badgeVariant: null,
    headlineSize: 'default',
    showAllergiesBanner: false
  },
  failed: {
    isCentered: false,
    showSpinner: false,
    badgeVariant: 'failure',
    headlineSize: 'default',
    showAllergiesBanner: false
  },
  noMatch: {
    isCentered: false,
    showSpinner: false,
    badgeVariant: 'noMatch',
    headlineSize: 'alternate',
    showAllergiesBanner: true
  },
  unconfirmed: {
    isCentered: false,
    showSpinner: false,
    badgeVariant: 'noMatch',
    headlineSize: 'default',
    showAllergiesBanner: false
  },
  terminal: {
    isCentered: false,
    showSpinner: false,
    badgeVariant: null,
    headlineSize: 'default',
    showAllergiesBanner: false
  }
}

interface GenerationViewCopy {
  headline: string
  body: string
}

const EMPTY_COPY: GenerationViewCopy = {headline: NO_VALUE, body: NO_VALUE}

const VIEW_COPY: Record<Exclude<GenerationViewKind, 'terminal'>, GenerationViewCopy> = {
  pending: {headline: MEAL_PLAN_GENERATING_TITLE, body: MEAL_PLAN_GENERATING_BODY},
  failed: {headline: MEAL_PLAN_GENERATION_FAILED_TITLE, body: MEAL_PLAN_GENERATION_FAILED_BODY},
  noMatch: {headline: MEAL_PLAN_NO_MATCH_TITLE, body: MEAL_PLAN_NO_MATCH_BODY},
  unconfirmed: {headline: MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE, body: MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY}
}

const resolveErrorKind = (error: unknown): GenerationViewKind => {
  if (classifyOutcome(error) === 'unknown') {
    return 'unconfirmed'
  }

  const code = getApiErrorCode(error)

  if (code === API_ERROR_CODES.noMatchingMeals) {
    return 'noMatch'
  }

  if (code !== null && TERMINAL_CODES.has(code)) {
    return 'terminal'
  }

  // Every other confirmed answer draws the failure state, plan_generation_failed and a code this
  // release does not recognise alike: the server described this attempt, so "your answers are saved"
  // is true, and 10b is the only confirmed state offering both a same-key retry and an edit.
  return 'failed'
}

// 'idle' and 'success' are transient frames — the screen fires the mutation on mount and leaves on
// success — so they render the spinner rather than nothing, which is what keeps the cold-start replay
// path from showing a blank screen before its request is in flight.
const resolveViewKind = (status: GenerationRequestStatus, error: unknown): GenerationViewKind =>
  status === 'error' ? resolveErrorKind(error) : 'pending'

const resolveViewCopy = (kind: GenerationViewKind, terminalCode: string | null): GenerationViewCopy => {
  if (kind !== 'terminal') {
    return VIEW_COPY[kind]
  }

  const terminal = terminalCode === null ? undefined : TERMINAL_COPY[terminalCode]

  return terminal === undefined ? EMPTY_COPY : {headline: terminal.title, body: terminal.body}
}

const generationAction = (kind: GenerationActionKind): GenerationAction => ({kind, label: ACTION_LABELS[kind]})

// The ordered pair is the footer order, which is how Figma 10c's inversion is expressed: when nothing
// matched, editing a preference is the primary move and retrying the same answers is the secondary one.
// A regeneration keeps its existing plan, so its secondary action returns to that plan instead of to setup.
const resolveActions = (kind: GenerationViewKind, context: GenerationContext): GenerationActionPair | null => {
  if (kind === 'pending' || kind === 'terminal') {
    return null
  }

  const isRegenerate = context.kind === 'regenerate'

  if (kind === 'noMatch') {
    return {
      primary: generationAction('editPreferences'),
      secondary: generationAction(isRegenerate ? 'backToPlan' : 'retry')
    }
  }

  return {
    primary: generationAction('retry'),
    secondary: generationAction(isRegenerate ? 'backToPlan' : 'editPreferences')
  }
}

export const resolveGenerationView = (
  status: GenerationRequestStatus,
  error: unknown,
  context: GenerationContext
): GenerationView => {
  const kind = resolveViewKind(status, error)
  const terminalCode = kind === 'terminal' ? getApiErrorCode(error) : null
  const chrome = VIEW_CHROME[kind]
  const copy = resolveViewCopy(kind, terminalCode)

  return {
    kind,
    isCentered: chrome.isCentered,
    showSpinner: chrome.showSpinner,
    badgeVariant: chrome.badgeVariant,
    headline: copy.headline,
    headlineSize: chrome.headlineSize,
    body: copy.body,
    showAllergiesBanner: chrome.showAllergiesBanner,
    actions: resolveActions(kind, context),
    terminalCode
  }
}

const dietValue = (preferences: MealPlanPreferences): string =>
  preferences.diet === null ? NO_VALUE : MEAL_PLAN_DIET_LABELS[preferences.diet]

const mealsPerDayValue = (preferences: MealPlanPreferences): string =>
  preferences.mealSchedule === null ? NO_VALUE : MEAL_PLAN_MEALS_PER_DAY_VALUES[preferences.mealSchedule]

const cookingTimeValue = (preferences: MealPlanPreferences): string =>
  preferences.cookingTimeLimitMin === null
    ? NO_VALUE
    : stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_MAX_TEMPLATE, {minutes: preferences.cookingTimeLimitMin})

// Every target field is independently nullable, so a calories-only or empty record renders an empty value
// rather than a zero the user never chose.
const targetsValue = (targets: NutritionTargets | null): string => {
  const calories = targets?.targets?.calories ?? null

  return calories === null
    ? NO_VALUE
    : stringWithNamedParameters(MEAL_PLAN_TARGETS_KCAL_TEMPLATE, {calories: formatCalories(calories)})
}

const allergiesValue = (preferences: MealPlanPreferences): string => {
  const namedCount = preferences.allergens.filter(allergen => allergen !== ALLERGEN_NONE).length

  return namedCount === 0
    ? MEAL_PLAN_ALLERGEN_LABELS.none
    : stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: namedCount})
}

export const resolveGenerationSummary = (
  kind: GenerationViewKind,
  preferences: MealPlanPreferences | null,
  targets: NutritionTargets | null
): GenerationSummary | null => {
  // No preferences means no card at all: a card of empty rows would read as answers the user gave, and
  // this is also the state before the preferences query resolves.
  if (preferences === null) {
    return null
  }

  if (kind === 'pending') {
    return {
      overline: MEAL_PLAN_GENERATING_SUMMARY_HEADER,
      rows: [
        {label: MEAL_PLAN_DIET_ROW_LABEL, value: dietValue(preferences)},
        {label: MEAL_PLAN_GENERATING_MEALS_PER_DAY_LABEL, value: mealsPerDayValue(preferences)},
        {label: MEAL_PLAN_GENERATING_COOKING_TIME_LABEL, value: cookingTimeValue(preferences)}
      ]
    }
  }

  if (kind === 'failed') {
    return {
      overline: MEAL_PLAN_SAVED_ANSWERS_HEADER,
      rows: [
        {label: MEAL_PLAN_TARGETS_ROW_LABEL, value: targetsValue(targets)},
        {label: MEAL_PLAN_DIET_ROW_LABEL, value: dietValue(preferences)},
        {label: MEAL_PLAN_ALLERGIES_ROW_LABEL, value: allergiesValue(preferences)}
      ]
    }
  }

  // noMatch shows the constraint card in the summary's place; unconfirmed must not claim answers were
  // saved when it has not been told they were; terminal leaves the screen.
  return null
}

const isLimitingConstraintKey = (value: unknown): value is LimitingConstraintKey =>
  CONSTRAINT_KEYS.some(key => key === value)

const isLimitingConstraintUnit = (value: unknown): value is LimitingConstraintUnit =>
  CONSTRAINT_UNITS.some(unit => unit === value)

const normalizeSlots = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((slot): slot is string => typeof slot === 'string') : []

// constraintKey and editStep decide whether an entry survives, because without them a row can neither be
// labelled nor edited. Everything else is normalized instead of dropped: a row whose value cannot be
// derived still earns its label and its Edit pill.
const toLimitingConstraint = (entry: unknown): LimitingConstraint | null => {
  if (entry === null || typeof entry !== 'object') {
    return null
  }

  const {constraintKey, value, unit, slots, editStep} = entry as Partial<LimitingConstraint>

  if (!isLimitingConstraintKey(constraintKey) || typeof editStep !== 'string') {
    return null
  }

  return {
    constraintKey,
    value: typeof value === 'number' && Number.isFinite(value) ? value : null,
    unit: isLimitingConstraintUnit(unit) ? unit : null,
    slots: normalizeSlots(slots),
    editStep
  }
}

export const extractLimitingConstraints = (error: unknown): LimitingConstraint[] => {
  const constraints = (error as {response?: {data?: {limitingConstraints?: unknown}}} | null)?.response?.data
    ?.limitingConstraints

  if (!Array.isArray(constraints)) {
    return []
  }

  return constraints
    .map(toLimitingConstraint)
    .filter((constraint): constraint is LimitingConstraint => constraint !== null)
}

const slotsValue = (slots: string[]): string =>
  slots
    .map(slot => SLOT_LABELS[slot])
    .filter((label): label is string => label !== undefined)
    .join(MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR)

const constraintValue = (constraint: LimitingConstraint, preferences: MealPlanPreferences | null): string => {
  if (constraint.unit !== null && constraint.value !== null) {
    return stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES[constraint.unit], {value: constraint.value})
  }

  const slots = slotsValue(constraint.slots)

  if (slots !== NO_VALUE) {
    return slots
  }

  // The 422 payload carries no diet code, so the diet row reads the user's own answer; every other
  // constraint without a value keeps its label and pill rather than showing its machine code.
  if (constraint.constraintKey === 'diet' && preferences !== null && preferences.diet !== null) {
    return MEAL_PLAN_DIET_LABELS[preferences.diet]
  }

  return NO_VALUE
}

// The server's order is its analysis order, so the rows are neither sorted nor de-duplicated here.
export const buildLimitingConstraintRows = (
  constraints: LimitingConstraint[],
  preferences: MealPlanPreferences | null
): LimitingConstraintRow[] =>
  constraints.map(constraint => {
    const label = MEAL_PLAN_LIMITING_CONSTRAINT_LABELS[constraint.constraintKey]

    return {
      constraintKey: constraint.constraintKey,
      label,
      value: constraintValue(constraint, preferences),
      editStep: constraint.editStep,
      editLabel: MEAL_PLAN_EDIT_LINK_TEXT,
      editAccessibilityLabel: stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE, {label})
    }
  })

// Review is the fallback because every answer is reachable from it, so an editStep from a newer server
// release opens a screen that can still resolve the constraint rather than a dead pill.
export const resolveConstraintEditRoute = (editStep: SetupStep): string =>
  CONSTRAINT_EDIT_ROUTES[editStep] ?? Screens.MEAL_PLAN_TARGETS

export const resolveConstraintReturnTo = (context: GenerationContext): ConstraintEditReturnTo =>
  context.kind === 'regenerate' ? 'settings' : 'review'

export const resolveActionRoute = (kind: GenerationActionKind, context: GenerationContext): string | null => {
  // Retry stays on this screen and replays the same idempotency key, so it names no route.
  if (kind === 'retry') {
    return null
  }

  if (kind === 'backToPlan') {
    return Screens.MACROS
  }

  return context.kind === 'regenerate' ? Screens.PLAN_SETTINGS : Screens.MEAL_PLAN_TARGETS
}
