import type {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import type {MealPlanPreferences, SetupStep} from '@data/models/MealPlanPreferences'
import {ALLERGEN_NONE, MEAL_SLOTS_IN_WIRE_ORDER} from '@data/models/MealPlanPreferences'
import type {NutritionTargets} from '@data/models/NutritionTargets'
import type {LimitingConstraint, LimitingConstraintKey, LimitingConstraintUnit} from '@data/models/PlanGenerationResult'
import type {MealSlot} from '@data/models/Recipe'
import type {GenerationContext, RootStackParamList} from '@navigation/types'
import type {IntentsHydration, MealPlanStore, PendingIntent} from '@store/mealPlan/useMealPlanStore'
import {buildPendingIntent, resolveKeyedRequest, resolveSlotOwnership} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, classifyOutcome, getApiErrorCode, terminalErrorCode} from '@utility/ApiErrorUtility'
import {MealPlanRequestSnapshot, requestPlanId, RequestScope} from '@utility/IdempotencyUtility'
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
  MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY,
  MEAL_PLAN_LIMITING_CONSTRAINT_LABELS,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_MEALS_PER_DAY_VALUES,
  MEAL_PLAN_NO_MATCH_BODY,
  MEAL_PLAN_NO_MATCH_TITLE,
  MEAL_PLAN_SAVED_ANSWERS_HEADER,
  MEAL_PLAN_SELECTED_VALUE_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TARGETS_KCAL_TEMPLATE,
  MEAL_PLAN_TARGETS_ROW_LABEL,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_SLOT_LABELS,
  stringWithNamedParameters,
  TerminalOutcomeCopy,
  TOAST_GENERIC_ERROR
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

// The secondary action is optional because a terminal card during setup has exactly one honest move: there is
// no plan to go back to and the refused key may not be retried, so it offers the edit alone rather than
// padding the footer with an action that would repeat the refusal.
export interface GenerationActionPair {
  primary: GenerationAction
  secondary: GenerationAction | null
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

// What a terminal outcome has to do on its way out, named rather than performed: the persisted intent, the
// plan query and the navigator all live outside a pure derivation, so the screen applies these while this
// module stays testable without them.
export interface GenerationTerminalRecovery {
  clearsPendingIntent: boolean
  refetchesCurrentPlan: boolean
  /**
   * Whether the refusal is answered by OPENING the plan the user already has, which is the one recovery that
   * has to wait for the refetch: the plan it selects is named by that answer rather than by anything the
   * screen holds (AAP 0.7.4). Implies `refetchesCurrentPlan`, and it is the refetch this flag makes awaited.
   */
  selectsUpcomingPlan: boolean
  toast: string | null
  route: keyof RootStackParamList | null
}

// The route's own params, which are what a cold start restores the screen from — so the request is rebuilt
// from them rather than held in memory by whatever navigated here.
export interface GenerationRequestInputs {
  context: GenerationContext
  startDate: string
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
}

/**
 * The two requests this screen can send: a generation names the week it builds, a regeneration the plan it
 * replaces. Narrower than `MealPlanRequestSnapshot` so the mutation call narrows on the action alone — a swap
 * or a log is never what this screen sends, not even when one is read back out of the persisted slot.
 */
export type GenerationRequestSnapshot = Extract<MealPlanRequestSnapshot, {action: 'generate' | 'regenerate'}>

/**
 * Everything the launch decision below is taken from. The persisted read arrives in both of its shapes
 * because they answer different questions: `hasHydratedIntents` is `'succeeded'` alone and is what the gate
 * fails closed on, while `intentsHydration` keeps the third case the screen has to SAY — a read that rejected,
 * whose contents are unknown rather than empty.
 */
export interface GenerationLaunchInput {
  pendingIntents: MealPlanStore['pendingIntents']
  userId: string | null
  /** The request this screen rebuilt from its route params (`buildGenerationRequest`). */
  request: GenerationRequestSnapshot
  hasHydratedIntents: boolean
  intentsHydration: IntentsHydration
  /** The key the route carries. Sent only where the action's slot is genuinely free. */
  idempotencyKey: string
  attemptedAt: number
}

/**
 * Whether this screen's attempt may leave, and under which key (0.7.2).
 *
 * `waiting` and `unreadable` are the two states of the persisted read that precede every other answer: until
 * the slice has come back, whether a generation is already pending is UNKNOWN, and a read that REJECTED
 * leaves it unknown rather than empty. Both send nothing; only the second is a state the user can act on, and
 * only through the re-read.
 *
 * `handOff` is the case the single `pendingIntents[action]` slot creates: it holds an unresolved request this
 * screen can neither replay (it is not the generation this route describes) nor overwrite (that would abandon
 * the only key able to reconcile a write the server may already have committed), so the Meal Plan tab — the
 * cold-start owner of a stranded generation — is given it instead.
 *
 * `send` carries the key the request must travel under and the request it must send: the STORED pair when this
 * screen's own generation is unresolved, the freshly routed pair otherwise. `intent` is the record to write
 * before the request leaves, and is null only where there is no account to scope it to.
 */
export type GenerationLaunchDecision =
  | {kind: 'waiting'}
  | {kind: 'unreadable'}
  | {kind: 'handOff'; intent: PendingIntent}
  | {
      kind: 'send'
      idempotencyKey: string
      /** True when the key is one the server may already have answered, so its reply can be a stored result. */
      isReplay: boolean
      request: GenerationRequestSnapshot
      intent: PendingIntent | null
    }

/**
 * What is known about the outcome of this screen's own attempt, and nothing more: either the server answered
 * it directly, or the plan read was refetched after a lost response and may or may not hold the plan that key
 * produced.
 */
export type GenerationSettlement =
  | {kind: 'committed'; plan: MealPlan}
  | {kind: 'refetched'; plans: CurrentMealPlans | null | undefined; sentKey: string | null}

const NO_VALUE = ''

// The two confirmed answers this screen still has a move for, and the only ones that are not terminal. Stated
// as the exception rather than terminality being stated as a list, because the list can never be complete:
// every other confirmed refusal — a validation error, the capability being off, a code a later server release
// introduces — is final for the idempotency key that earned it, and a key that is never retired is replayed on
// every cold start for as long as the intent survives (0.7.2).
//
// `plan_generation_failed` keeps 10b's same-key retry and `no_matching_meals` keeps 10c's edit; the AAP
// reserves those drawn states for exactly these two outcomes (0.2.5).
const RETRYABLE_CONFIRMED_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.planGenerationFailed,
  API_ERROR_CODES.noMatchingMeals
])

// The two plan-state refusals deliberately carry no card copy: the plan this attempt named has already moved
// on, so their recovery leaves the screen with the stale-plan toast and a refetch rather than stranding the
// user on a card whose only honest next move is somewhere else.
const PLAN_STATE_TERMINAL_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.stalePlan,
  API_ERROR_CODES.planNotActive
])

// Meal planning itself is off behind a mounted backend, so no card on this screen would be true for long and
// none of its next moves exist. Like the plan-state refusals it leaves immediately — to the Macros tab, where
// the entitlement router turns the very same signal into the unavailable card (0.2.5).
const UNAVAILABLE_TERMINAL_CODES: ReadonlySet<string> = new Set<string>([API_ERROR_CODES.featureDisabled])

// The refusal that already has its answer on the server: a second plan may not start after today because one
// already does, and AAP 0.7.4 says that plan is OPENED rather than described. A card whose only move was
// "Edit preferences" led back to Review, where every further Generate earns this very refusal again — so this
// family leaves too, selecting the upcoming plan on the way.
const UPCOMING_PLAN_TERMINAL_CODES: ReadonlySet<string> = new Set<string>([API_ERROR_CODES.upcomingExists])

// Whether a terminal outcome draws a card at all. The three families above answer with a destination instead,
// so they render no copy and no footer; every other terminal code states what moved on a card the user can
// read and leave from.
const leavesScreenWithoutCard = (terminalCode: string): boolean =>
  PLAN_STATE_TERMINAL_CODES.has(terminalCode) ||
  UNAVAILABLE_TERMINAL_CODES.has(terminalCode) ||
  UPCOMING_PLAN_TERMINAL_CODES.has(terminalCode)

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

// The two analyses whose finding is a meal slot rather than a measurement: coverage is evaluated per slot, so
// the server sends the slots it found thin or empty alongside the count it found there, and 0.7.3 has the
// analysis name the slot. '0 recipes' on its own is the one value a constraint row can carry that the user
// cannot act on — it says a count without saying of what — so these two keep the slot and the count together
// while every other key carries no slots at all and reads as its measurement.
const COVERAGE_CONSTRAINT_KEYS: ReadonlySet<LimitingConstraintKey> = new Set<LimitingConstraintKey>([
  'slot_coverage',
  'catalog_coverage'
])

// The closed set behind the setup-step guard below. A string the server sent is only a SetupStep once it has
// been matched against it: the wire types say nothing about what this release understands, and a value that
// skips the check reaches a map lookup as an arbitrary key. The slot guard matches against the wire-order table
// @data/models/MealPlanPreferences owns, which is the same closed set of slots the schedule step writes.
const SETUP_STEPS: readonly SetupStep[] = [
  'goal',
  'body',
  'activity',
  'diet',
  'dislikes',
  'schedule',
  'cooking',
  'review',
  'targets_manual'
]

// Record<string, string> indexing types as string, so all three maps are read through a widened alias to
// keep the unknown-key branch reachable: a slot, allergen or terminal code from a newer server release must
// never be rendered raw, and an absent entry must fall through rather than reach a formatter as undefined.
const SLOT_LABELS: Record<string, string | undefined> = MEAL_SLOT_LABELS

const ALLERGEN_LABELS: Record<string, string | undefined> = MEAL_PLAN_ALLERGEN_LABELS

const TERMINAL_COPY: Record<string, TerminalOutcomeCopy | undefined> = MEAL_PLAN_GENERATION_TERMINAL_COPY

const CONSTRAINT_EDIT_ROUTES: Record<SetupStep, keyof RootStackParamList> = {
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

// Every map above is keyed by a string the server chose, and a plain record[key] answers 'constructor',
// 'toString', 'hasOwnProperty' and '__proto__' with an inherited function or object. Those pass an
// `!== undefined` check, so they would reach the UI as "function Object() { [native code] }" or be returned
// as a route that is not a string at all. Only an own property counts as an entry.
const ownEntry = <T>(record: Record<string, T | undefined>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined

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
// 10 and 10b both centre their content column on both axes, and the unconfirmed variant renders in 10b's
// layout, so those three agree. Only 10c is top-aligned — its column declares neither centring key, its copy
// is left-aligned and its badge starts at the content edge, because the constraint rows under it are a list
// to read — and the terminal state, which Figma never draws and whose recovery leaves immediately.
const VIEW_CHROME: Record<GenerationViewKind, GenerationViewChrome> = {
  pending: {
    isCentered: true,
    showSpinner: true,
    badgeVariant: null,
    headlineSize: 'default',
    showAllergiesBanner: false
  },
  failed: {
    isCentered: true,
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
    isCentered: true,
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

// The three states an error can still act on, each reached by naming its own outcome. Anything that is not
// one of them has already been classified terminal by `terminalErrorCode`, so no fallback state has to stand
// in for "confirmed, but not a case this module lists" — which is what previously sent a 400, a 503 and any
// future code into 10b's same-key retry with the key left pending.
const resolveErrorKind = (error: unknown, terminalCode: string | null): GenerationViewKind => {
  if (terminalCode !== null) {
    return 'terminal'
  }

  if (classifyOutcome(error) === 'unknown') {
    return 'unconfirmed'
  }

  const code = getApiErrorCode(error)

  if (code === API_ERROR_CODES.noMatchingMeals) {
    return 'noMatch'
  }

  if (code === API_ERROR_CODES.planGenerationFailed) {
    return 'failed'
  }

  // Unreachable: a confirmed answer carries a readable code, and one that is neither of the two above is
  // terminal. The unconfirmed variant is the fail-safe because it is the only state that promises nothing.
  return 'unconfirmed'
}

// 'idle' and 'success' are transient frames — the screen fires the mutation on mount and leaves on
// success — so they render the spinner rather than nothing, which is what keeps the cold-start replay
// path from showing a blank screen before its request is in flight.
const resolveViewKind = (
  status: GenerationRequestStatus,
  error: unknown,
  terminalCode: string | null
): GenerationViewKind => (status === 'error' ? resolveErrorKind(error, terminalCode) : 'pending')

const resolveViewCopy = (kind: GenerationViewKind, terminalCode: string | null): GenerationViewCopy => {
  if (kind !== 'terminal') {
    return VIEW_COPY[kind]
  }

  if (terminalCode === null || leavesScreenWithoutCard(terminalCode)) {
    return EMPTY_COPY
  }

  const terminal = ownEntry(TERMINAL_COPY, terminalCode)

  // A refusal this release has no copy for still has to say something true and offer the same way out, so it
  // borrows the wording every terminal card shares rather than rendering an empty card.
  return terminal === undefined
    ? {
        headline: MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY.title,
        body: MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY.body
      }
    : {headline: terminal.title, body: terminal.body}
}

const generationAction = (kind: GenerationActionKind): GenerationAction => ({kind, label: ACTION_LABELS[kind]})

// The ordered pair is the footer order, which is how Figma 10c's inversion is expressed: when nothing
// matched, editing a preference is the primary move and retrying the same answers is the secondary one.
// A regeneration keeps its existing plan, so its secondary action returns to that plan instead of to setup.
const resolveActions = (
  kind: GenerationViewKind,
  context: GenerationContext,
  terminalCode: string | null
): GenerationActionPair | null => {
  if (kind === 'pending') {
    return null
  }

  const isRegenerate = context.kind === 'regenerate'

  // A terminal card names what moved but cannot resolve it here, and this screen draws no back button while
  // the tab bar is hidden — so the footer is the only way off it. Retry is deliberately absent: the key has
  // been retired, and the same request would earn the same refusal.
  if (kind === 'terminal') {
    return terminalCode === null || leavesScreenWithoutCard(terminalCode)
      ? null
      : {
          primary: generationAction('editPreferences'),
          secondary: isRegenerate ? generationAction('backToPlan') : null
        }
  }

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
  // The terminal code is read first, from the shared classification, and the view kind follows from it: the
  // same answer must not be terminal for the key lifecycle and retryable for the card, or the intent would be
  // retired under a screen still offering to replay it.
  const terminalCode = status === 'error' ? terminalErrorCode(error, RETRYABLE_CONFIRMED_CODES) : null
  const kind = resolveViewKind(status, error, terminalCode)
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
    actions: resolveActions(kind, context, terminalCode),
    terminalCode
  }
}

// Every terminal code retires the keyed intent, including one this release has never seen: a confirmed answer
// describes the attempt the key was minted for, and leaving the intent pending would replay that key on the
// next cold start against a refusal the server will only repeat. Which recovery follows is the family's:
//
// - a plan-state refusal leaves for the authoritative plan with the stale-plan toast and a refetch, because
//   the plan the attempt named is no longer the one the user has;
// - the capability being off leaves for the Macros tab and refetches, so the entitlement router draws the
//   unavailable card from the same signal — a toast would only repeat what that card says;
// - an upcoming plan already existing is answered by opening that plan: the refetch names it, the selection
//   follows it and the segment switches, because the week the user asked for is a week they already have
//   (0.7.4). Its toast is the card copy this code already owns, said once on the way out instead of drawn on
//   a card whose only move led back to the screen that earns the same refusal;
// - every other refusal states its next move on a card the user reads and leaves through the footer, so it
//   neither toasts nor routes.
//
// The two retryable codes and an unknown outcome are not terminal and have no recovery: their key is still
// the only safe way to ask again.
export const resolveTerminalRecovery = (
  terminalCode: string | null,
  context: GenerationContext
): GenerationTerminalRecovery | null => {
  if (terminalCode === null || RETRYABLE_CONFIRMED_CODES.has(terminalCode)) {
    return null
  }

  if (PLAN_STATE_TERMINAL_CODES.has(terminalCode)) {
    return {
      clearsPendingIntent: true,
      refetchesCurrentPlan: true,
      selectsUpcomingPlan: false,
      toast: MEAL_PLAN_STALE_PLAN_TOAST,
      route: context.kind === 'regenerate' ? Screens.MACROS : Screens.MEAL_PLAN_TARGETS
    }
  }

  if (UNAVAILABLE_TERMINAL_CODES.has(terminalCode)) {
    return {
      clearsPendingIntent: true,
      refetchesCurrentPlan: true,
      selectsUpcomingPlan: false,
      toast: null,
      route: Screens.MACROS
    }
  }

  if (UPCOMING_PLAN_TERMINAL_CODES.has(terminalCode)) {
    return {
      clearsPendingIntent: true,
      refetchesCurrentPlan: true,
      selectsUpcomingPlan: true,
      // The code's own card title, read through the same own-property lookup every copy read goes through, so
      // this recovery cannot state something the copy inventory does not hold. A release that ever drops the
      // entry leaves for the plan without a toast rather than toasting a machine code.
      toast: ownEntry(TERMINAL_COPY, terminalCode)?.title ?? null,
      route: Screens.MACROS
    }
  }

  return {
    clearsPendingIntent: true,
    refetchesCurrentPlan: false,
    selectsUpcomingPlan: false,
    toast: null,
    route: null
  }
}

/**
 * Which refusal of the PERSISTED INTENT layer the screen is standing on, and the copy it says it with — or
 * null when nothing about that layer is refusing.
 *
 * Both members refuse for the same reason and are kept as one derivation so the screen cannot say it two
 * ways: the record that makes a lost response replayable is not on the device, so no keyed request may leave
 * (0.7.2). They differ only in which call failed and therefore in which one the action retries — `read` is a
 * rehydration that rejected, so what the slot holds is unknown; `write` is a reservation the device did not
 * confirm, so the key about to be sent would exist only in this process.
 *
 * `read` is answered first because it is the stricter state: a launch that never reached `send` has nothing
 * to reserve, so a stale write refusal must not outrank it.
 */
export type IntentRefusalKind = 'read' | 'write'

export interface IntentRefusal {
  kind: IntentRefusalKind
  body: string
  actionLabel: string
}

export const resolveIntentRefusal = (
  launchKind: GenerationLaunchDecision['kind'],
  isReservationRefused: boolean
): IntentRefusal | null => {
  if (launchKind === 'unreadable') {
    return {kind: 'read', body: MEAL_PLAN_LOAD_ERROR_TITLE, actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
  }

  // A refused reservation only means anything for an attempt the launch permitted: any other decision has
  // already sent nothing, and its own state is what the screen is showing.
  return launchKind === 'send' && isReservationRefused
    ? {kind: 'write', body: TOAST_GENERIC_ERROR, actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
    : null
}

/**
 * The plan an `upcoming_exists` refusal is answered by: the upcoming week the refetch reported, or null when
 * the answer carries none.
 *
 * Null is a real answer rather than an error. The plan may have rolled into `current` between the refusal and
 * the refetch, or another client may have replaced it, and in both cases the recovery still leaves for the
 * Meal Plan tab — which reads `current ?? upcoming` on its own (0.7.4) — instead of stranding the user on a
 * screen whose outcome has no card. An empty id is not an identity, for the same reason a key is not.
 */
export const resolveUpcomingPlanId = (plans: CurrentMealPlans | null | undefined): string | null => {
  const upcoming = plans?.upcoming ?? null

  return upcoming !== null && upcoming.id.length > 0 ? upcoming.id : null
}

/**
 * A plan as this settlement reads it: its id, and the generation key it MAY carry.
 *
 * Declared here rather than taken from the model because the wire contract does not promise the member — AAP
 * 0.5.2's `MealPlanResponse` has no `generationKey` — so a conforming server may omit it and the model may
 * declare it required, nullable, or not at all. The rule below must answer identically in all three cases, and
 * `id` is required in the shape so a plan stays assignable to it however the key is declared.
 */
interface PlanGenerationKeyBearer {
  id: string
  generationKey?: string | null
}

// Only a key that is actually there can prove a plan belongs to this attempt, so an absent, null or empty
// value answers null — which can never equal the non-empty key the caller has already checked for.
const planGenerationKey = (plan: PlanGenerationKeyBearer): string | null => {
  const key = plan.generationKey ?? null

  return typeof key === 'string' && key.length > 0 ? key : null
}

/**
 * The plan the tab must open once this screen's generation is settled, and null while nothing in hand proves
 * that it is.
 *
 * A confirmed commit is its own proof: the response IS the plan, whichever week it is. That is why the
 * selection follows the returned plan instead of being left where it was — a next-week generation or an
 * upcoming-plan regeneration would otherwise reopen the week that happened to be on screen.
 *
 * After a lost response there is exactly one proof: a refetched plan whose `generationKey` equals the key
 * this attempt sent. Dates, revisions and generation attempts cannot tell the plan that key committed from
 * one another device made or from the week it was about to replace, so anything short of that exact match
 * leaves the refetch display-only — the intent stays pending and the screen keeps promising nothing, because
 * only a server answer to the same key may resolve it (0.2.5, 0.7.2).
 */
export const resolveSettledGenerationPlanId = (settlement: GenerationSettlement): string | null => {
  if (settlement.kind === 'committed') {
    return settlement.plan.id
  }

  const {plans, sentKey} = settlement

  // An absent or empty key is not an identity. Guarded here because it is the one comparison that must never
  // succeed by accident — an attempt that never went out has nothing to reconcile against.
  if (plans === null || plans === undefined || sentKey === null || sentKey.length === 0) {
    return null
  }

  const {current, upcoming} = plans

  if (current !== null && planGenerationKey(current) === sentKey) {
    return current.id
  }

  return upcoming !== null && planGenerationKey(upcoming) === sentKey ? upcoming.id : null
}

/**
 * The request this screen's attempt sends, as the snapshot stored beside its idempotency key. Built here
 * because the two shapes a generating screen can carry are its own: a regeneration replaces one identified
 * plan at a known revision, while setup and next-week generations name a start date. `nextWeek` carries that
 * date on the context itself, which is preferred over the route's copy so the two can never disagree.
 *
 * Pairing this with `resolveKeyedRequest` is what makes a lost response recoverable: the same inputs rebuild
 * the same request, so the stored key is replayed byte-identically instead of a second plan being generated
 * under a new one (0.7.2).
 */
export const buildGenerationRequest = (inputs: GenerationRequestInputs): GenerationRequestSnapshot => {
  if (inputs.context.kind === 'regenerate') {
    return {
      action: 'regenerate',
      planId: inputs.context.planId,
      expectedPlanRevision: inputs.context.planRevision,
      expectedPreferencesRevision: inputs.expectedPreferencesRevision,
      expectedTargetsRevision: inputs.expectedTargetsRevision
    }
  }

  return {
    action: 'generate',
    startDate: inputs.context.kind === 'nextWeek' ? inputs.context.startDate : inputs.startDate,
    expectedPreferencesRevision: inputs.expectedPreferencesRevision,
    expectedTargetsRevision: inputs.expectedTargetsRevision
  }
}

// One send, assembled from the request it carries so the recorded snapshot, the key and the body cannot
// describe three different generations.
const generationSend = (
  request: GenerationRequestSnapshot,
  idempotencyKey: string,
  isReplay: boolean,
  intent: PendingIntent | null
): GenerationLaunchDecision => ({kind: 'send', idempotencyKey, isReplay, request, intent})

// A record filed under the generate or regenerate slot carries one of those two snapshots, so this narrows the
// union rather than guarding a reachable case. It answers null instead of throwing because the slot's contents
// come from device storage: a record a future release filed differently is one this screen may not act on, and
// null routes it to the hand-off rather than to a mint.
const asGenerationSnapshot = (snapshot: MealPlanRequestSnapshot): GenerationRequestSnapshot | null =>
  snapshot.action === 'generate' || snapshot.action === 'regenerate' ? snapshot : null

/**
 * Whether a stored snapshot describes the generation this screen was opened for. A regeneration is identified
 * by the plan it replaces, a generation by the week it builds.
 *
 * The revisions each request pins are deliberately NOT compared. A moved preferences or targets revision is
 * the same user intent under a key that may already have committed, so the stored request is replayed under
 * its stored key — the byte-identical replay a lost response requires — and it is a confirmed refusal
 * (`409 stale_revision`) that retires it and frees the slot for a fresh key (0.7.2).
 */
const namesSameGeneration = (stored: GenerationRequestSnapshot, request: GenerationRequestSnapshot): boolean => {
  if (stored.action === 'regenerate' && request.action === 'regenerate') {
    return stored.planId === request.planId
  }

  return stored.action === 'generate' && request.action === 'generate' && stored.startDate === request.startDate
}

/**
 * Which generation this screen launches as it opens, and under which key (0.7.2).
 *
 * The rule the single `pendingIntents[action]` slot forces: a key is minted only when no unresolved
 * generation is on record. An unresolved one is a request whose answer was lost, so it may have committed —
 * recording a new key over it would abandon the only key that could ever reconcile that write and would ask
 * the server for a second plan. So an unresolved generation of *this* week (or of *this* plan) is replayed
 * instead, under its stored key and carrying its stored request, which the server answers with the stored
 * result when the write landed and re-runs under the same key when it did not.
 *
 * The persisted read gates all of it, because "nothing is pending" and "the answer has not arrived" are
 * different answers and only the first permits a fresh key. A read that REJECTED is the stricter case: the
 * slice may hold a key for a generation the server committed, so it is refused rather than treated as empty —
 * which is what the screen offers `retryIntentsHydration` for.
 */
export const resolveGenerationLaunch = (input: GenerationLaunchInput): GenerationLaunchDecision => {
  // Intents are scoped by account, so with no signed-in id there is nothing on disk this session may replay
  // and nothing it could overwrite: the attempt leaves under the route's key with no record to write. Reached
  // only if identity is somehow absent inside the signed-in tree — `isAuthed` and `userId` are published
  // together — and it is ordered first for that reason: it is the absence of the account the rest reasons about.
  if (input.userId === null) {
    return generationSend(input.request, input.idempotencyKey, false, null)
  }

  if (input.intentsHydration === 'failed') {
    return {kind: 'unreadable'}
  }

  // The boolean, not the third state: it is 'succeeded' alone, so a read that has not answered — or answered
  // in a way this release has no word for — still refuses the mint.
  if (!input.hasHydratedIntents) {
    return {kind: 'waiting'}
  }

  const state: Pick<MealPlanStore, 'pendingIntents'> = {pendingIntents: input.pendingIntents}
  const planId = requestPlanId(input.request)
  // A regeneration names the plan it replaces, so the slot is read against it and another plan's record comes
  // back as 'foreign'. A generation names no plan, so every unresolved generation is this action's own record
  // and `namesSameGeneration` is what tells this week's from another's.
  const scope: RequestScope = planId === null ? {} : {planId}
  const ownership = resolveSlotOwnership(state, input.request.action, input.userId, input.attemptedAt, scope)

  if (ownership.kind === 'foreign') {
    return {kind: 'handOff', intent: ownership.intent}
  }

  if (ownership.kind === 'mine') {
    const stored = asGenerationSnapshot(ownership.intent.request)

    if (stored === null || !namesSameGeneration(stored, input.request)) {
      return {kind: 'handOff', intent: ownership.intent}
    }

    // Re-recorded with the intent's own `createdAt`, so the write restates the record rather than extending
    // the 7-day life of a key that was minted a week ago.
    return generationSend(
      stored,
      ownership.intent.key,
      true,
      buildPendingIntent(stored, ownership.intent.key, input.userId, ownership.intent.createdAt)
    )
  }

  // The slot is free, so this launch is a new intent and may mint. The key it travels under still comes from
  // the decision all four keyed writes share rather than from a second rule living here.
  const keyed = resolveKeyedRequest(state, input.request, input.userId, input.attemptedAt, input.idempotencyKey)
  const sent = asGenerationSnapshot(keyed.request) ?? input.request

  return generationSend(
    sent,
    keyed.idempotencyKey,
    keyed.isReplay,
    buildPendingIntent(sent, keyed.idempotencyKey, input.userId, input.attemptedAt)
  )
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

// The named allergies this release can actually name, counted once each: the sentinel is an answer rather
// than an allergy, a code a non-compliant payload repeated is still one allergy, and a code no label exists
// for is one the row cannot claim the user selected — a count is a promise about what the plan excluded, so
// it counts only what this release understands. Dropping the sentinel here is also what enforces its
// exclusivity: a payload carrying 'none' beside named codes reads as those named codes.
const namedAllergens = (allergens: string[]): string[] =>
  Array.from(
    new Set(
      allergens.filter(allergen => allergen !== ALLERGEN_NONE && ownEntry(ALLERGEN_LABELS, allergen) !== undefined)
    )
  )

const allergiesValue = (preferences: MealPlanPreferences): string => {
  const named = namedAllergens(preferences.allergens)

  if (named.length > 0) {
    return stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: named.length})
  }

  // 'None' is an answer the user gave on 05, so it is printed only when the sentinel is actually there. An
  // empty list is the unanswered row, and it reads empty for the reason the rows above do: a recap must not
  // show an answer as given when it was not.
  return preferences.allergens.includes(ALLERGEN_NONE) ? MEAL_PLAN_ALLERGEN_LABELS.none : NO_VALUE
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

const isSetupStep = (value: unknown): value is SetupStep => SETUP_STEPS.some(step => step === value)

const isMealSlot = (value: unknown): value is MealSlot => MEAL_SLOTS_IN_WIRE_ORDER.some(slot => slot === value)

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
    // Review is the fallback because every answer is reachable from it, so an editStep from a newer server
    // release opens a screen that can still resolve the constraint rather than a dead pill. Normalising here
    // rather than at the route lookup is also what keeps a name like 'constructor' out of every map this
    // step is later used to key: the returned editStep is always a genuine union member.
    editStep: isSetupStep(editStep) ? editStep : 'review'
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

// The slot strings survive normalization unlabelled because they are the server's payload, so the closed-set
// check happens here, at the only point one becomes text: a slot this release cannot name contributes
// nothing to the value rather than rendering its raw code.
const slotsValue = (slots: string[]): string =>
  slots
    .filter(isMealSlot)
    .map(slot => ownEntry(SLOT_LABELS, slot))
    .filter((label): label is string => typeof label === 'string')
    .join(MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR)

// A measurement is only a measurement once the analysis gave both halves: a unit with no figure, or a figure
// with no unit, is not a value this module can phrase, and the template would render the brace it could not
// substitute.
const measurementValue = (constraint: LimitingConstraint): string =>
  constraint.unit !== null && constraint.value !== null
    ? stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES[constraint.unit], {value: constraint.value})
    : NO_VALUE

// MEAL_PLAN_VALUE_SEPARATOR's own contract: an absent segment drops together with its separator, so one
// segment renders alone and an empty list renders as nothing rather than as a stray middot.
const joinValueSegments = (segments: readonly string[]): string =>
  segments.filter(segment => segment !== NO_VALUE).join(MEAL_PLAN_VALUE_SEPARATOR)

const constraintValue = (constraint: LimitingConstraint, preferences: MealPlanPreferences | null): string => {
  const measurement = measurementValue(constraint)

  // A coverage analysis always answers with both parts, so precedence would silently discard one of them. The
  // slots lead because the affected slot is the finding — the count qualifies it — and because a value the
  // row has to truncate must lose the qualifier rather than the answer.
  if (COVERAGE_CONSTRAINT_KEYS.has(constraint.constraintKey)) {
    return joinValueSegments([slotsValue(constraint.slots), measurement])
  }

  if (measurement !== NO_VALUE) {
    return measurement
  }

  // Defensive: no other key is sent with slots today, but one that arrives with them is better read as the
  // slots it named than as an empty row.
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

// The guard repeats here even though toLimitingConstraint already normalizes: this export's argument is only
// as good as its caller, and a SetupStep cast from wire data is still just a string wearing a type's name.
// Review's own route is the fallback, for the reason toLimitingConstraint states.
export const resolveConstraintEditRoute = (editStep: SetupStep): keyof RootStackParamList => {
  const route = isSetupStep(editStep) ? ownEntry(CONSTRAINT_EDIT_ROUTES, editStep) : undefined

  return typeof route === 'string' ? route : CONSTRAINT_EDIT_ROUTES.review
}

export const resolveConstraintReturnTo = (context: GenerationContext): ConstraintEditReturnTo =>
  context.kind === 'regenerate' ? 'settings' : 'review'

export const resolveActionRoute = (
  kind: GenerationActionKind,
  context: GenerationContext
): keyof RootStackParamList | null => {
  // Retry stays on this screen and replays the same idempotency key, so it names no route.
  if (kind === 'retry') {
    return null
  }

  if (kind === 'backToPlan') {
    return Screens.MACROS
  }

  return context.kind === 'regenerate' ? Screens.PLAN_SETTINGS : Screens.MEAL_PLAN_TARGETS
}
