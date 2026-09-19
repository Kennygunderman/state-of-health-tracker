import {
  CurrentMealPlans,
  MealPlan,
  MealPlanDay,
  MealPlanDayEnvelope,
  MealPlanFlag,
  MealPlanMeal
} from '@data/models/MealPlan'
import {MealPlanPreferences, SetupStatus} from '@data/models/MealPlanPreferences'
import {SwapMealPayload} from '@data/models/SwapAlternative'
import {MealPlanAvailability} from '@hooks/mealPlanning/useMealPlanEntitlement.util'
import {RootStackParamList} from '@navigation/types'
import {LogPlannedMealPayload} from '@queries/api/mealPlanning/logPlannedMeal'
import {
  IntentsHydration,
  MealPlanStore,
  PendingIntent,
  PendingIntentAction,
  resolveReplayableIntent
} from '@store/mealPlan/useMealPlanStore'
import type {PostLogResult} from '@store/mealPlan/useMealPlanStore'
import {
  isFeatureDisabledError,
  isPlanReadInvalidatedError,
  isPlanStateError,
  isUnknownOutcome
} from '@utility/ApiErrorUtility'
import {
  LogRequestSnapshot,
  MealPlanRequestSnapshot,
  resolveMountReplay,
  SwapRequestSnapshot
} from '@utility/IdempotencyUtility'
import {
  clampDayKeyToPlan,
  defaultSelectedPlanDate,
  isLastPlanDay,
  parseDayKey,
  resolvePostLogViewTarget
} from '@utility/MealPlanDateUtility'
import {isWriteAllowedByVerdict} from '@utility/MealPlanLifecycleUtility'
import {resolveSetupResumeTarget, SetupResumeTarget} from '@utility/MealPlanSetupResumeUtility'
import {lookupLabel} from '@utility/TextUtility'
import {format} from 'date-fns'

import Screens from '@constants/screens'
import {
  hasMealFlagTemplate,
  MEAL_PLAN_ADDED_TO_DAY_SLOT_TEMPLATE,
  MEAL_PLAN_ADDED_TO_SLOT_TEMPLATE,
  MEAL_PLAN_ALLERGEN_SENTENCE_LABELS,
  MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_CREATE_BUTTON_TEXT,
  MEAL_PLAN_DIET_SENTENCE_LABELS,
  MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE,
  MEAL_PLAN_MEAL_COUNT_TEMPLATE,
  MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR,
  MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT,
  MEAL_PLAN_PLAN_NEXT_WEEK_BUTTON_TEXT,
  MEAL_SLOT_LABELS,
  mealFlagTemplate,
  PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON,
  stringWithNamedParameters
} from '@constants/strings'

// The plan surfaces that name a weekday in prose spell it out, unlike the day strip's abbreviation.
const WEEKDAY_FORMAT = 'EEEE'

// The four names the diary backfills its buckets with, which is what a logged entry's bucket label can be.
const CANONICAL_BUCKET_LABELS: readonly string[] = Object.values(MEAL_SLOT_LABELS)

const EMPTY_PLAN_CTAS: Record<SetupStatus, EmptyPlanCta> = {
  not_started: 'create',
  in_progress: 'continueSetupStep',
  ready_for_review: 'continueSetupReview',
  completed: 'planNextWeek'
}

export type EmptyPlanCta = 'create' | 'continueSetupStep' | 'continueSetupReview' | 'planNextWeek'

/**
 * `isSavedCopy` marks the one plan state that is not live: the plan comes from the persisted
 * `mealPlanCurrent` cache while the request behind it is failing, so the tab renders it read-only under the
 * neutral "showing your last saved plan" banner. A healthy background refetch leaves it `false` — the plan
 * re-renders in place and stays writable.
 */
export type MealPlanBodyOutcome =
  | {kind: 'unavailable'}
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'plan'; plan: MealPlan; isSavedCopy: boolean}
  | {kind: 'empty'; cta: EmptyPlanCta}

export interface MealPlanBodyInputs {
  availability: MealPlanAvailability
  preferences: MealPlanPreferences | undefined
  preferencesError: unknown
  plans: CurrentMealPlans | undefined
  currentPlanError: unknown
  isLoading: boolean
  selectedPlanId: string | null
}

export type PlanSwitchLink = 'next' | 'this'

export type LastDayAction = 'planAnotherWeek' | 'viewNextWeek'

export type LoggedEntryRef = MealPlanMeal['loggedEntries'][number]

export type MealLoggedState =
  | {kind: 'unlogged'}
  | {kind: 'logged'; entry: LoggedEntryRef}
  | {kind: 'loggedThenSwapped'; entry: LoggedEntryRef}

/**
 * What the selected day has to show, and whether what it shows is complete.
 *
 * `hasFailedRead` is the disclosure the day content cannot carry itself: the content came from the week the
 * plan response already held, while the day route — the only source of the logged entries and of the write
 * verdict — failed. Without it the plan reads as usable and its write controls do nothing.
 */
export type MealPlanDaySection =
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'day'; day: MealPlanDay; hasFailedRead: boolean}

export interface MealPlanDayInputs {
  plan: MealPlan
  selectedDayKey: string
  envelope: MealPlanDayEnvelope | null
  dayError: unknown
}

// What a meal card renders, derived once per day rather than per card per render.
export interface MealCardModel {
  meal: MealPlanMeal
  loggedState: MealLoggedState
}

/**
 * The plan and day a post-log banner was raised against. It is captured because `postLogResult` records
 * neither, and a banner that cannot name its own plan survives a replacement plan covering the same dates.
 */
export interface PostLogBannerOrigin {
  entryId: string
  planId: string | null
  /**
   * The PLAN day the banner was raised on, which is where it stands (AAP 0.1.4 iii — until "View diary" is
   * tapped, the selected day or plan changes, or the user leaves the segment).
   *
   * It cannot be read from `postLogResult`: that record carries the DIARY date the entry landed on, and frame
   * 15's date stepper may have moved it to another day of the plan week. Comparing the diary date against the
   * selected day is what cleared the required banner the moment the two differed. Bound lazily beside
   * `planId`, because both resolve from the same render — the selected day is only a plan day once a plan is
   * on screen, and the logging screen writes the planned date into the selection in the same commit as the
   * result.
   */
  dayKey: string | null
  /**
   * The newest successful swap at the moment this banner was raised, as that mutation's `submittedAt`.
   *
   * A watermark rather than a pending flag, because the lifecycle retires the confirmation when another swap
   * COMPLETES: a swap that failed, or whose answer was lost, changed nothing the confirmation was describing
   * and must leave it standing. `submittedAt` only ever increases for a later mutation, so a greater value
   * than this one can only mean a further swap has since succeeded — and the cache dropping an older entry
   * lowers the observed value instead of raising it, which the comparison reads as no new swap rather than as
   * one.
   */
  lastSwapSucceededAt: number
}

export interface PostLogBannerInputs {
  result: PostLogResult | null
  origin: PostLogBannerOrigin | null
  dismissedEntryId: string | null
  planId: string | null
  selectedDayKey: string
  lastSwapSucceededAt: number
}

const hasError = (error: unknown): boolean => error !== null && error !== undefined

/**
 * A plan this screen may no longer read, whichever request surfaced it and whichever way the server said so:
 * it replaced or ended the plan, or the resource is not this caller's. All of them earn the one recovery —
 * the stale-plan toast and a current-plan refetch — because the plan the screen holds is the wrong plan, and
 * none of them is worth a retry that would ask the same disowned resource again.
 *
 * It takes the error rather than a decoded code because the code alone is not an answer: the shared
 * classification confirms an outcome from the status as well as the body, so a 5xx that merely echoed
 * `stale_plan` is excluded. Recovering on one would tell a user whose plan is live that it had been replaced,
 * and would abandon a read a second attempt would have completed.
 */
export function isStalePlanError(error: unknown): boolean {
  return isPlanReadInvalidatedError(error)
}

const resolveEmptyPlanCta = (preferences: MealPlanPreferences | undefined): EmptyPlanCta =>
  preferences ? EMPTY_PLAN_CTAS[preferences.setupStatus] : 'create'

// Same-format ISO-8601 timestamps compare lexicographically, so the later entry is found without parsing a
// Date; the reduce also leaves the caller's array untouched, which Array.prototype.sort would not.
const isLaterEntry = (candidate: LoggedEntryRef, incumbent: LoggedEntryRef): boolean =>
  candidate.loggedAt === incumbent.loggedAt
    ? candidate.entryId > incumbent.entryId
    : candidate.loggedAt > incumbent.loggedAt

/**
 * Branch order is load-bearing.
 *
 * Unavailability is the entitlement verdict rather than a re-reading of the responses. A decoded stale-plan
 * or resource-route failure invalidates the plan itself, so it outranks everything below — including a plan
 * the cache still holds, which that answer has just contradicted, and an in-flight refetch, behind whose
 * spinner it would be hidden.
 *
 * Every other failure leaves the saved plan standing: `mealPlanCurrent` is persisted precisely so the week
 * survives a lost connection, so a plan in hand is rendered read-only as a saved copy rather than replaced
 * by an error card that hides a week the user can still read. The error card is for having nothing to show.
 * No error path may fall through to `empty`, which would claim the user has no plan when the request merely
 * failed.
 */
export function resolveMealPlanBody(inputs: MealPlanBodyInputs): MealPlanBodyOutcome {
  const {availability, preferences, preferencesError, plans, currentPlanError, isLoading, selectedPlanId} = inputs

  if (availability !== 'enabled') {
    return {kind: 'unavailable'}
  }

  if (isStalePlanError(preferencesError) || isStalePlanError(currentPlanError)) {
    return {kind: 'error'}
  }

  const plan = resolveSelectedPlan(plans, selectedPlanId)
  const isRefreshFailing = hasError(preferencesError) || hasError(currentPlanError)

  if (plan !== null) {
    return {kind: 'plan', plan, isSavedCopy: isRefreshFailing}
  }

  if (isLoading) {
    return {kind: 'loading'}
  }

  if (isRefreshFailing) {
    return {kind: 'error'}
  }

  return {kind: 'empty', cta: resolveEmptyPlanCta(preferences)}
}

/**
 * The Generating route's own params, which is all a reconstructed route needs: the screen rebuilds its request
 * from them (`buildGenerationRequest`), so a route rebuilt from a stored snapshot sends the very request the
 * stored key was minted for.
 */
export type MealPlanGeneratingParams = RootStackParamList[typeof Screens.MEAL_PLAN_GENERATING]

/**
 * `idle` leaves the tab rendering its normal state; `handoff` is the one frame in which the tab opens the
 * Generating screen for an unresolved generation, carrying the STORED key so the attempt there is a replay
 * rather than a second plan under a new key (0.7.2).
 *
 * NO OUTCOME RESOLVES AN INTENT FROM A READ. A plan read refetched by this tab is display-only: it may show a
 * generation that has already been published, but it does not settle the request that published it, because
 * only a server answer to the same key may — a stored replay, a fresh commit, or a confirmed terminal error
 * (0.2.5). The handoff is how that answer is obtained: the Generating screen replays the stored key and
 * retires the record from the keyed response, which is also what frees the action's single slot.
 *
 * `hydrating` and `unreadable` are the two answers that precede every other: until the persisted slice has
 * been read, whether a keyed write is pending is UNKNOWN, and a refused read leaves it unknown rather than
 * empty. They are separate because they are acted on differently — waiting is waiting, while a refusal is a
 * state only `retryIntentsHydration` leaves.
 */
export type PendingGenerationOutcome =
  | {kind: 'idle'}
  | {kind: 'hydrating'}
  | {kind: 'unreadable'}
  | {kind: 'handoff'; params: MealPlanGeneratingParams}

/**
 * `navigatedKey` is the latch the caller keeps: the key this tab has already handed over for the handoff it is
 * currently holding. One handoff per key is what keeps the tab from re-opening Generating on every render
 * while that screen is on top; the latch is released when the tab loses focus (`resolveHandoffLatch`), so
 * returning to a still-unresolved intent reconstructs its owner again rather than exposing normal state over a
 * key nobody owns.
 */
export interface PendingGenerationDecision {
  outcome: PendingGenerationOutcome
  navigatedKey: string | null
}

export interface PendingGenerationInputs {
  intents: Pick<MealPlanStore, 'pendingIntents'>
  userId: string | null
  now: number
  /**
   * How the persisted slice came back. The three states are kept apart here rather than collapsed to a
   * boolean because the tab has to SAY which it is: 'pending' waits, 'failed' offers the retry that is the
   * only way out of it, and only 'succeeded' permits any conclusion about what is stored.
   */
  intentsHydration: IntentsHydration
  /**
   * Whether this tab may navigate at all: it is the focused route, meal planning is available, and the plan
   * read has settled. Handing off while the plan read is still in flight would reconstruct the owner for a
   * generation the very next answer proves has already been published.
   */
  isHandoffAllowed: boolean
  isGenerationInFlight: boolean
  navigatedKey: string | null
  plans: CurrentMealPlans | undefined
  /** The day key a reconstructed regeneration shows as its week when that plan is not in hand. */
  todayDayKey: string
}

// The two keyed writes that own a screen of their own. Swap and log are replayed silently in place, so they
// never reconstruct a route. Declared in precedence order, which decides ties below.
const GENERATION_ACTIONS: readonly PendingIntentAction[] = ['generate', 'regenerate']

type GenerationRequestSnapshot = Extract<MealPlanRequestSnapshot, {action: 'generate' | 'regenerate'}>

// The three members of a stored record a reconstructed route is built from, narrowed to the two generation
// snapshots so the route can be built without re-testing the action at every use.
interface GenerationIntent {
  key: string
  createdAt: number
  request: GenerationRequestSnapshot
}

const isGenerationSnapshot = (snapshot: MealPlanRequestSnapshot): snapshot is GenerationRequestSnapshot =>
  snapshot.action === 'generate' || snapshot.action === 'regenerate'

const asGenerationIntent = (intent: PendingIntent | null): GenerationIntent | null =>
  intent !== null && isGenerationSnapshot(intent.request)
    ? {key: intent.key, createdAt: intent.createdAt, request: intent.request}
    : null

const planById = (plans: CurrentMealPlans | undefined, planId: string): MealPlan | null => {
  const current = plans?.current ?? null

  if (current !== null && current.id === planId) {
    return current
  }

  const upcoming = plans?.upcoming ?? null

  return upcoming !== null && upcoming.id === planId ? upcoming : null
}

/**
 * Every generation record this tab still owns, newest first, answered or not.
 *
 * Newest first because that is the request the user is waiting on. `sort` is stable, so two intents recorded
 * in the same millisecond keep `GENERATION_ACTIONS` order rather than an arbitrary one.
 */
const liveGenerationIntents = (inputs: PendingGenerationInputs): GenerationIntent[] =>
  GENERATION_ACTIONS.map(action =>
    asGenerationIntent(resolveReplayableIntent(inputs.intents, action, inputs.userId, inputs.now))
  )
    .filter((intent): intent is GenerationIntent => intent !== null)
    .sort((left, right) => right.createdAt - left.createdAt)

/**
 * The route params that reconstruct the Generating screen for a stored request.
 *
 * Every value comes from the snapshot, never from current query data: the screen rebuilds its request from
 * these params, and a rebuilt request that differs in any member is a different request — which the server
 * answers with `409 idempotency_conflict` for a reused key (0.5.1, 0.7.2).
 *
 * The two exceptions are display copy the request does not contain. A regeneration keeps the dates the plan
 * already has, so its `startDate` param only names the week on the card and is read from that plan when the
 * payload holds it. A generation's context is `nextWeek` when the user already has a week — the only state in
 * which a second plan can be asked for — and `setup` otherwise; both spell the same `startDate` into the
 * rebuilt request, so the choice changes where "Edit preferences" leads and nothing about the replay.
 */
const buildGeneratingParams = (
  intent: GenerationIntent,
  plans: CurrentMealPlans | undefined,
  todayDayKey: string
): MealPlanGeneratingParams => {
  const request = intent.request

  if (request.action === 'regenerate') {
    return {
      context: {kind: 'regenerate', planId: request.planId, planRevision: request.expectedPlanRevision},
      idempotencyKey: intent.key,
      expectedPreferencesRevision: request.expectedPreferencesRevision,
      expectedTargetsRevision: request.expectedTargetsRevision,
      startDate: planById(plans, request.planId)?.startDate ?? todayDayKey
    }
  }

  const hasPlan = (plans?.current ?? null) !== null || (plans?.upcoming ?? null) !== null

  return {
    context: hasPlan ? {kind: 'nextWeek', startDate: request.startDate} : {kind: 'setup'},
    idempotencyKey: intent.key,
    expectedPreferencesRevision: request.expectedPreferencesRevision,
    expectedTargetsRevision: request.expectedTargetsRevision,
    startDate: request.startDate
  }
}

/**
 * Who owns a generation whose response was lost, once the route that made it is gone.
 *
 * Navigation state is not persisted, so after a cold start — or after the user simply walked away — nothing
 * is left holding the Generating screen, and the plan the request may already have committed would never be
 * asked for again. This tab is the state router for the whole feature, so it is where that ownership lands:
 * it opens Generating for the stored intent and the screen replays the stored snapshot under the stored key
 * (AAP 0.7.2), which is what obtains the server's answer to that key and retires the record.
 *
 * THIS FUNCTION NEVER SETTLES AN INTENT ITSELF, and in particular not from `inputs.plans`. A refetched week
 * may well be the one a lost response published, but a read is display-only and only an answer to the same
 * key may resolve the request that made it (0.2.5). So a record whose plan is already on screen is handed
 * over exactly like any other: the replay returns the stored response, the mutation retires the record, and
 * the slot is free again — with no path on which a read decides a keyed write is done.
 *
 * Branch order is load-bearing. Hydration comes first because "no intent" and "not read yet" are different
 * answers, and deciding before the persisted slice has come back would conclude that nothing is pending. What
 * is left is handed over once per key, and never while an attempt for it is already on the wire — two answers
 * to one key is the race the latch and the in-flight gate exist to prevent.
 */
export function resolvePendingGeneration(inputs: PendingGenerationInputs): PendingGenerationDecision {
  if (inputs.intentsHydration !== 'succeeded') {
    return {
      outcome: {kind: inputs.intentsHydration === 'failed' ? 'unreadable' : 'hydrating'},
      navigatedKey: inputs.navigatedKey
    }
  }

  const [intent] = liveGenerationIntents(inputs)
  const replay = resolveMountReplay({
    intent: intent ?? null,
    isReady: inputs.isHandoffAllowed,
    isRequestInFlight: inputs.isGenerationInFlight,
    replayedKey: inputs.navigatedKey
  })

  if (!replay.replays || intent === undefined) {
    return {outcome: {kind: 'idle'}, navigatedKey: replay.replayedKey}
  }

  return {
    outcome: {kind: 'handoff', params: buildGeneratingParams(intent, inputs.plans, inputs.todayDayKey)},
    navigatedKey: replay.replayedKey
  }
}

/**
 * The two keyed writes this tab owns in place rather than by reconstructing a route (AAP 0.7.2 — "the Meal
 * Plan tab for swap/log"). A generation needs its own screen because it has nothing to show meanwhile; a swap
 * or a log is a single request whose answer lands in the week already on screen.
 */
export type InPlaceWriteAction = Extract<PendingIntentAction, 'swap' | 'log'>

/**
 * The unresolved in-place write on record: the ids the mutation instance is built from, and the key the replay
 * is latched by. Read from the stored snapshot, never from the day on screen — the record may name a meal on
 * another day or in another week, and it is that meal's write that has to be finished.
 */
export interface InPlaceWriteIntent {
  planId: string
  mealId: string
  key: string
}

export interface InPlaceWriteInputs {
  intents: Pick<MealPlanStore, 'pendingIntents'>
  userId: string | null
  now: number
  intentsHydration: IntentsHydration
  /**
   * Whether the tab may act as the silent owner at all: it is the route on screen and meal planning is
   * available. Focus is what keeps this tab and the write's own screen from ever sending one key at the same
   * time — the screen is the focused route while it is open — and availability is the gate no gated request
   * may cross (0.2.5).
   */
  isReplayAllowed: boolean
  /** Whether an attempt for this action is already on the wire, from this tab or from the owning screen. */
  isRequestInFlight: boolean
  replayedKey: string | null
}

/**
 * What the tab does about one in-place write this frame.
 *
 * `intent` is reported whether or not the replay fires, because it is what the tab's own Swap and Log controls
 * are withheld on (`arePlanActionsOffered`) and what the mutation instance is addressed with — an unresolved
 * record must not be replaceable while its key is unanswered (0.7.2).
 *
 * `payload` is the STORED body under the STORED key, and non-null only on the frame that owes the silent
 * replay. A replay is answered with the stored result only while it reproduces the request the key was minted
 * for, so nothing here is rebuilt from query data: a rebuilt body earns `409 idempotency_conflict` or commits
 * the write a second time (0.5.1, 0.7.2).
 */
export interface InPlaceWriteOwnership<TPayload> {
  intent: InPlaceWriteIntent | null
  payload: TPayload | null
  replayedKey: string | null
}

/**
 * The record for one in-place action, or null when there is nothing this tab owns.
 *
 * No `RequestScope` is passed, and that is the whole difference between this tab and the swap and log screens:
 * they are showing one meal and may only replay that meal's key, whereas this tab is the GLOBAL owner of the
 * action's single slot, so every live record for it is its own to finish. Hydration is checked first because
 * an unread slice is unknown rather than empty, and nothing — least of all a request — may be decided from it
 * (0.7.2).
 */
const ownedInPlaceIntent = (inputs: InPlaceWriteInputs, action: InPlaceWriteAction): PendingIntent | null =>
  inputs.intentsHydration === 'succeeded'
    ? resolveReplayableIntent(inputs.intents, action, inputs.userId, inputs.now)
    : null

const ownedSwapWrite = (
  inputs: InPlaceWriteInputs
): {intent: InPlaceWriteIntent; request: SwapRequestSnapshot} | null => {
  const intent = ownedInPlaceIntent(inputs, 'swap')

  if (intent === null || intent.request.action !== 'swap') {
    return null
  }

  return {
    intent: {planId: intent.request.planId, mealId: intent.request.mealId, key: intent.key},
    request: intent.request
  }
}

const ownedLogWrite = (
  inputs: InPlaceWriteInputs
): {intent: InPlaceWriteIntent; request: LogRequestSnapshot} | null => {
  const intent = ownedInPlaceIntent(inputs, 'log')

  if (intent === null || intent.request.action !== 'log') {
    return null
  }

  return {
    intent: {planId: intent.request.planId, mealId: intent.request.mealId, key: intent.key},
    request: intent.request
  }
}

// The 0.5.2 swap body, assembled from the stored snapshot under the stored key — the same four members
// `IdempotencyUtility.requestBody` produces for a swap, which the util test pins by comparison.
const swapReplayBody = (request: SwapRequestSnapshot, key: string): SwapMealPayload => ({
  recipeVersionId: request.recipeVersionId,
  portionMultiplier: request.portionMultiplier,
  expectedPlanRevision: request.expectedPlanRevision,
  idempotencyKey: key
})

// The 0.5.2 planned-log body, on the same terms: the servings, date and diary bucket the user chose when the
// key was minted, not the ones the screen would rebuild from today's data.
const logReplayBody = (request: LogRequestSnapshot, key: string): LogPlannedMealPayload => ({
  servings: request.servings,
  date: request.date,
  diaryMealId: request.diaryMealId,
  expectedPlanRevision: request.expectedPlanRevision,
  idempotencyKey: key
})

/**
 * Whether this tab owes the unresolved swap its one silent same-key attempt, and the body that attempt carries.
 *
 * This is the cold-start owner AAP 0.7.2 asks for. The commit is fired from the preview screen, so after a
 * process death the mutation cache holds nothing and navigation state is gone — the persisted record is the
 * only trace of what the user asked for, and no route reopens on its own. Without this the write would sit
 * unfinished while the tab drew a week that may already have changed.
 *
 * One replay per key and never while an attempt is on the wire (`resolveMountReplay`, shared with the other
 * three keyed writes). Nothing here resolves the intent: only a server answer to that key may (0.2.5).
 */
export function resolveSwapOwnership(inputs: InPlaceWriteInputs): InPlaceWriteOwnership<SwapMealPayload> {
  const owned = ownedSwapWrite(inputs)
  const replay = resolveMountReplay({
    intent: owned?.intent ?? null,
    isReady: inputs.isReplayAllowed && inputs.userId !== null,
    isRequestInFlight: inputs.isRequestInFlight,
    replayedKey: inputs.replayedKey
  })

  return {
    intent: owned?.intent ?? null,
    payload: replay.replays && owned !== null ? swapReplayBody(owned.request, owned.intent.key) : null,
    replayedKey: replay.replayedKey
  }
}

/**
 * The same ownership for the planned log, and the one that most needs it: the log screen rebuilds its request
 * from the servings, date and bucket currently on screen, so an intent nobody replays is an intent whose next
 * attempt is a DIFFERENT request under a new key — a second diary entry for the meal the user logged once
 * (0.7.2). The stored snapshot is sent instead, unchanged.
 */
export function resolveLogOwnership(inputs: InPlaceWriteInputs): InPlaceWriteOwnership<LogPlannedMealPayload> {
  const owned = ownedLogWrite(inputs)
  const replay = resolveMountReplay({
    intent: owned?.intent ?? null,
    isReady: inputs.isReplayAllowed && inputs.userId !== null,
    isRequestInFlight: inputs.isRequestInFlight,
    replayedKey: inputs.replayedKey
  })

  return {
    intent: owned?.intent ?? null,
    payload: replay.replays && owned !== null ? logReplayBody(owned.request, owned.intent.key) : null,
    replayedKey: replay.replayedKey
  }
}

/**
 * The outcome of the tab's own silent replay, as the state that still needs an owner.
 *
 * `'unknown'` is an answer nothing has given yet — the write may have committed before its response was lost —
 * and `'failed'` is a confirmed refusal the server has already described. Both are AAP 0.2.5 states that
 * belong on the ACTION's own screen (swap → `SwapMeal`, log → `LogPlannedMeal`), which is why the key travels
 * with them: the destination finds the attempt and the stored record by that key and owns every mapping from
 * there.
 */
export interface RestoredWriteReport {
  action: InPlaceWriteAction
  key: string
  outcome: 'failed' | 'unknown'
}

/**
 * What the tab does with one failed replay.
 *
 * `recoversStalePlan` is the existing stale-plan recovery — the toast AND the current-plan refetch it already
 * carries — so `refetchesCurrentPlan` is never true beside it: it is the silent re-read the capability
 * refusal earns, where the segment's own unavailable card is what states the reason.
 */
export interface RestoredWriteDisposition {
  clearsIntent: boolean
  recoversStalePlan: boolean
  refetchesCurrentPlan: boolean
  report: RestoredWriteReport | null
}

export interface RestoredWriteDispositionInputs {
  action: InPlaceWriteAction
  /** The key the replay was sent under — the one the owning screen has to be handed. */
  key: string
  error: unknown
}

/**
 * What a failed silent replay leaves behind, and who owns what is left.
 *
 * Branch order is the precedence, and each branch answers a different question about the key.
 *
 * An UNKNOWN outcome answers nothing: the write may have committed before the response was lost, so the record
 * stays as the only safe way to ask again (0.7.2) and the state is reported, because a plan tab drawing its
 * ordinary week over an unresolved key tells the user nothing about the write they made (0.2.5).
 *
 * `503 feature_disabled` is the capability verdict rather than this write's fate: the record goes, and the
 * Meal Plan segment's unavailable card explains it once. Nothing is reported — routing into the write's own
 * screen would bounce straight back out through that screen's own recovery — and the plan is re-read so the
 * entitlement latch and the body agree.
 *
 * A confirmed plan-state answer (`409 stale_plan`, `409 plan_not_active`) retires the key and takes the
 * stale-plan recovery the AAP asks for (0.7.2). No report: the plan the write named is gone, so there is no
 * meal, no day and no revision left to route to.
 *
 * Anything else is a confirmed refusal of THIS key — `502 swap_failed`, `422 recipe_ineligible`,
 * `409 idempotency_conflict`, a 400 — and it is exactly the state 0.2.5 draws on the action's own screen. The
 * record is KEPT so that screen re-sends the same stored key, receives the same confirmed answer and retires
 * the key through its own mapping, rather than this tab clearing it silently and leaving nothing said.
 */
export function resolveRestoredWriteDisposition(inputs: RestoredWriteDispositionInputs): RestoredWriteDisposition {
  const {action, key, error} = inputs

  if (isUnknownOutcome(error)) {
    return {
      clearsIntent: false,
      recoversStalePlan: false,
      refetchesCurrentPlan: false,
      report: {action, key, outcome: 'unknown'}
    }
  }

  if (isFeatureDisabledError(error)) {
    return {clearsIntent: true, recoversStalePlan: false, refetchesCurrentPlan: true, report: null}
  }

  if (isPlanStateError(error)) {
    return {clearsIntent: true, recoversStalePlan: true, refetchesCurrentPlan: false, report: null}
  }

  return {
    clearsIntent: false,
    recoversStalePlan: false,
    refetchesCurrentPlan: false,
    report: {action, key, outcome: 'failed'}
  }
}

/**
 * The route that owns a reported state, as the screen to open and the params to open it with.
 *
 * Discriminated rather than one params object with a screen name beside it, so the caller's `navigate` call
 * types against the route it names without a cast — the same shape `onWriteActionPressed` navigates with.
 */
export type RestoredWriteTarget =
  | {screen: 'swap'; params: RootStackParamList[typeof Screens.SWAP_MEAL]}
  | {screen: 'log'; params: RootStackParamList[typeof Screens.LOG_PLANNED_MEAL]}

/**
 * What the tab does about a reported state this frame.
 *
 * `idle` leaves the report standing: there is nothing to report, or the tab may not navigate yet (it is not
 * the route on screen, or meal planning is unavailable), so the handoff fires when focus returns rather than
 * being dropped. `settled` is a report whose record is no longer on file — the write resolved elsewhere — so
 * there is nothing to hand off and the report is simply dropped. `pending` is a report the current-plan read
 * has not answered yet, which also leaves it standing. `handoff` is the one frame the owning screen is opened
 * in. `unreachable` is a record the read has ANSWERED about and whose plan or meal is not in
 * `{current, upcoming}` — a superseded or ended week — where no route can be built: a confirmed refusal is
 * then retired and reported by toast, while an unknown outcome keeps its key, because that key remains the
 * only safe way to ask again and the next open owns it (0.7.2).
 *
 * `pending` and `unreachable` are separate because they are opposite facts that look alike. The replay fires
 * as soon as the persisted slice is read (0.7.2) and runs beside the current-plan query, not after it, so a
 * refusal routinely arrives while `plans` is still `undefined` — a cold start whose plan entry expired, or
 * was never persisted, answers the mutation first. Reading that silence as "no route exists" would retire a
 * confirmed refusal with nothing but a toast and drop an unknown outcome's report, which is the whole defect
 * the routing exists to remove: the state would never reach the screen 0.2.5 draws it on. Holding the report
 * instead costs nothing, because this resolver answers from render values and is reconsidered the frame the
 * read lands.
 */
export type RestoredWriteRecovery =
  | {kind: 'idle'}
  | {kind: 'settled'; action: InPlaceWriteAction; key: string}
  | {kind: 'pending'; action: InPlaceWriteAction; key: string}
  | {kind: 'handoff'; action: InPlaceWriteAction; key: string; target: RestoredWriteTarget}
  | {kind: 'unreachable'; action: InPlaceWriteAction; key: string; clearsIntent: boolean; reportsError: boolean}

export interface RestoredWriteRecoveryInputs {
  report: RestoredWriteReport | null
  /** The swap and log records still on file, from `resolveSwapOwnership` / `resolveLogOwnership`. */
  swapIntent: InPlaceWriteIntent | null
  logIntent: InPlaceWriteIntent | null
  plans: CurrentMealPlans | undefined
  /** Whether the tab may navigate at all: it is the focused route and meal planning is available. */
  isHandoffAllowed: boolean
  /** The key this tab has already handed over, so one report opens one screen once. */
  handedOffKey: string | null
}

/**
 * The PLANNED day of the meal a record names, and the revision to pin its next attempt to.
 *
 * Both are read from the current-plan response rather than from the stored snapshot, because neither is in it:
 * the snapshot's `date` is the DIARY date a log was written to (frame 15's stepper moves it within the plan
 * week), and its `expectedPlanRevision` is the revision the refused attempt was built against. The destination
 * screens are addressed by the plan day the meal sits on, at the revision the plan carries now.
 */
const locateRestoredWrite = (
  // Required, not optional: an unanswered read is held by the caller before this is reached, so a `null` here
  // can only mean the read answered and does not hold the record's plan or meal.
  plans: CurrentMealPlans,
  intent: InPlaceWriteIntent
): {date: string; planRevision: number} | null => {
  const plan = planById(plans, intent.planId)

  if (plan === null) {
    return null
  }

  const day = plan.days.find(candidate => candidate.meals.some(meal => meal.id === intent.mealId))

  return day === undefined ? null : {date: day.date, planRevision: plan.revision}
}

/**
 * Who owns the state the tab's own replay reported, and with what.
 *
 * AAP 0.2.5 puts both unconfirmed states on the action's own screen, and those screens already own every
 * mapped outcome: `SwapMeal` finds the attempt this tab fired by its idempotency key in the shared mutation
 * cache and replays the stored key once on open, and `LogPlannedMeal` replays through `planStoredLogReplay`
 * and maps confirmed failures through `classifyLogFailure`. So the handoff carries no outcome copy — only the
 * route and the ids the screen needs to reconstruct the write.
 *
 * Branch order is load-bearing. The navigation gate comes first, because a report withheld is a report kept.
 * The record is then re-read: a key that is no longer on file, or a record that has moved on to another key,
 * has been resolved by something else and leaves nothing to hand off. An unanswered current-plan read is held
 * next, so the absence of data is never mistaken for the absence of a route. Only then is the route built, and
 * only from a plan and meal the read actually holds.
 */
export function resolveRestoredWriteRecovery(inputs: RestoredWriteRecoveryInputs): RestoredWriteRecovery {
  const {report} = inputs

  if (report === null || !inputs.isHandoffAllowed || inputs.handedOffKey === report.key) {
    return {kind: 'idle'}
  }

  const intent = report.action === 'swap' ? inputs.swapIntent : inputs.logIntent

  if (intent === null || intent.key !== report.key) {
    return {kind: 'settled', action: report.action, key: report.key}
  }

  // Held rather than judged: `undefined` is a read that has not answered, and only an answer can say whether
  // the record's plan is on file. A rejected replay reaching this resolver first is the ordinary case, not an
  // edge one.
  if (inputs.plans === undefined) {
    return {kind: 'pending', action: report.action, key: report.key}
  }

  const located = locateRestoredWrite(inputs.plans, intent)

  if (located === null) {
    const isConfirmedRefusal = report.outcome === 'failed'

    return {
      kind: 'unreachable',
      action: report.action,
      key: report.key,
      clearsIntent: isConfirmedRefusal,
      reportsError: isConfirmedRefusal
    }
  }

  const params = {
    planId: intent.planId,
    mealId: intent.mealId,
    date: located.date,
    planRevision: located.planRevision
  }

  return {
    kind: 'handoff',
    action: report.action,
    key: report.key,
    target: report.action === 'swap' ? {screen: 'swap', params} : {screen: 'log', params}
  }
}

/**
 * What the tab draws, once the persisted intent slice has had its say.
 *
 * `body` is the tab's ordinary rendering. `withheld` is the non-interactive frame: the slice has not been read
 * yet, or a generation is unsettled and being handed to its owner. `intentsUnreadable` is the refused read,
 * which needs an action rather than a placeholder.
 */
export type MealPlanTabFrame =
  | {kind: 'body'; outcome: MealPlanBodyOutcome}
  | {kind: 'withheld'}
  | {kind: 'intentsUnreadable'}

/**
 * Whether the tab may show its ordinary surfaces yet.
 *
 * The plan and setup surfaces carry the writes — Swap, Log, and the routes that generate a plan — so they may
 * not be drawn while the existence of an unresolved keyed write is unknown: a press then mints a second key
 * beside one the server may already have committed (0.7.2). A read that is still out and a read that was
 * refused are both "unknown", so both withhold; they differ only in what is drawn, because a refusal is a
 * state nothing but `retryIntentsHydration` leaves.
 *
 * `unavailable` stays ahead of the gate. The feature is switched off or its routes are gone, so there is no
 * keyed write to own and nothing on that card to press — withholding it would replace a truthful answer with
 * a placeholder that can never resolve.
 */
export function resolveTabFrame(
  planOutcome: MealPlanBodyOutcome,
  generation: PendingGenerationOutcome
): MealPlanTabFrame {
  if (planOutcome.kind === 'unavailable') {
    return {kind: 'body', outcome: planOutcome}
  }

  if (generation.kind === 'unreadable') {
    return {kind: 'intentsUnreadable'}
  }

  return generation.kind === 'idle' ? {kind: 'body', outcome: planOutcome} : {kind: 'withheld'}
}

/**
 * The handoff latch the tab keeps, scoped to the handoff it is holding rather than to its own lifetime.
 *
 * One handoff per key is what stops the tab re-opening Generating on every render while that screen sits on
 * top of it. Holding the same latch for the whole process is a refusal, though: if Generating is popped or
 * backed out of while its intent is still unresolved, the tab would draw its normal plan surfaces over a key
 * nobody owns. Losing focus is exactly the moment the handoff has been taken, so the latch is released there
 * and a return to a still-unresolved intent reconstructs the owner again. Nothing about duplicate sends rests
 * on the latch — the in-flight gate is what prevents those.
 */
export function resolveHandoffLatch(navigatedKey: string | null, isFocused: boolean): string | null {
  return isFocused ? navigatedKey : null
}

// What a withheld frame shows: the same placeholder the first load shows, because a week a pending request
// may already have replaced is not an answer while that request is unsettled (0.7.2).
const WITHHELD_FRAME_OUTCOME: MealPlanBodyOutcome = {kind: 'loading'}

// A refused persisted read is drawn as the inline retry card, which is the 0.2.5 treatment for "couldn't load
// this right now" — the one thing that can move this state along is asking again.
const UNREADABLE_INTENTS_FRAME_OUTCOME: MealPlanBodyOutcome = {kind: 'error'}

/**
 * The body outcome a frame is drawn from, so the header, the body and every value derived from a plan are read
 * from one decision rather than from two that could disagree about whether a plan is on screen.
 */
export function resolveFrameOutcome(frame: MealPlanTabFrame): MealPlanBodyOutcome {
  if (frame.kind === 'body') {
    return frame.outcome
  }

  return frame.kind === 'withheld' ? WITHHELD_FRAME_OUTCOME : UNREADABLE_INTENTS_FRAME_OUTCOME
}

/**
 * What the selected day renders, and what it must disclose about itself.
 *
 * The day route is the fresher read — its meals carry the logged entries and its envelope the write verdict —
 * and the plan's own day stands in for it until it answers, so switching days never empties the screen. That
 * substitute is also the seed the day query starts from, so it is present or absent as one: `null` here is
 * both "no seed" and "nothing cached for this day", which is why the loading and error branches below are the
 * only states with nothing to show.
 *
 * An answer that invalidates the plan itself is deliberately not disclosed as a failed read — neither the
 * confirmed plan-state codes nor the resource route's `404 {error: 'Plan not found'}`, which covers a plan
 * that is absent or foreign and a date outside the plan's week. Those are owned by the stale-plan toast and
 * the current-plan refetch, which can discover the replacement; an inline retry would only ask the same
 * disowned resource again. Seeded content still renders behind that recovery, and the write verdict stays
 * unanswered, so the day is readable but not writable while it runs.
 */
export function resolveMealPlanDaySection(inputs: MealPlanDayInputs): MealPlanDaySection {
  const {plan, selectedDayKey, envelope, dayError} = inputs
  const day = envelope?.day ?? plan.days.find(candidate => candidate.date === selectedDayKey) ?? null
  const hasFailedRead = hasError(dayError) && !isStalePlanError(dayError)

  if (day === null) {
    return hasFailedRead ? {kind: 'error'} : {kind: 'loading'}
  }

  return {kind: 'day', day, hasFailedRead}
}

/**
 * Whether the day on screen may offer its Swap and Log actions.
 *
 * `dayWriteability` is `MealPlanDayEnvelope.isWritable` for the SELECTED day — the server's verdict, computed
 * against the calendar day of the user's saved IANA zone — and it is the only thing that opens these controls.
 * Nothing here is derived from the plan's dates or from the device's day: the stored status reads 'active' for
 * a week that finished last month, and the device's day is not the saved zone's day after travel, so either
 * one draws two controls the server refuses `409 plan_not_active {reason: 'ended'}`. An unanswered verdict
 * (`null` from the display-only seed, `undefined` before any envelope) offers nothing.
 *
 * `hasUnresolvedKeyedWrite` withholds both controls while a swap or log key is still unanswered, for the same
 * reason the swap screen withholds its alternatives: `pendingIntents[action]` holds exactly ONE record, so a
 * second swap or log started now would overwrite the only record that can reconcile a write the server may
 * already have committed (0.7.2). The controls come back with the answer that retires that record.
 *
 * The body outcome is taken whole rather than a plan, because the saved-copy case is part of the same
 * question: a plan restored from the persisted cache while its request fails cannot have its revision trusted
 * as the `expectedPlanRevision` of a write, and a write refused for a stale revision is a worse answer than a
 * control that was never offered.
 */
/**
 * Whether an unresolved keyed write belongs to some OTHER meal than the one whose control was pressed.
 *
 * The single slot per action must not be replaceable while its key is unanswered, which is why an unresolved
 * record withholds these controls at all. But withholding them on the meal the record NAMES would close the
 * only door the AAP leaves open: a swap or log whose outcome is unknown is answered on its own screen, which
 * draws the unconfirmed state and offers the "Try again" that replays that very key (0.2.5). Blocking that
 * screen would leave the user with no way to resolve the write until a new process.
 *
 * So the rule is per meal: the owning meal keeps its controls, every other meal loses them until the record is
 * retired. A record carrying a different plan counts as another meal's, because the key names a plan too.
 */
export function isKeyedWriteHeldByAnotherMeal(
  unresolved: readonly (InPlaceWriteIntent | null)[],
  planId: string,
  mealId: string
): boolean {
  return unresolved.some(intent => intent !== null && (intent.planId !== planId || intent.mealId !== mealId))
}

export function arePlanActionsOffered(
  outcome: MealPlanBodyOutcome,
  dayWriteability: boolean | null | undefined,
  hasUnresolvedKeyedWrite: boolean
): boolean {
  return (
    outcome.kind === 'plan' &&
    !outcome.isSavedCopy &&
    !hasUnresolvedKeyedWrite &&
    isWriteAllowedByVerdict(dayWriteability)
  )
}

export function resolveSelectedPlan(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): MealPlan | null {
  const current = plans?.current ?? null
  const upcoming = plans?.upcoming ?? null
  const fallback = current ?? upcoming

  if (selectedPlanId === null) {
    return fallback
  }

  if (current !== null && current.id === selectedPlanId) {
    return current
  }

  if (upcoming !== null && upcoming.id === selectedPlanId) {
    return upcoming
  }

  return fallback
}

/**
 * The value the caller stores back. A selection naming a plan the server no longer returns has to be
 * cleared, or it would keep shadowing the plan actually on screen — but only a concrete `{current,
 * upcoming}` response can establish that. An unfetched response carries no evidence either way, so the
 * selection is preserved through it; clearing it there would drop the user back onto the default plan on
 * every cold start, one render before the upcoming week they had chosen arrived.
 */
export function resolveStalePlanSelection(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): string | null {
  if (selectedPlanId === null || plans === undefined) {
    return selectedPlanId
  }

  const matchesReturnedPlan = plans.current?.id === selectedPlanId || plans.upcoming?.id === selectedPlanId

  return matchesReturnedPlan ? selectedPlanId : null
}

export function resolvePlanSwitchLink(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): PlanSwitchLink | null {
  const current = plans?.current ?? null
  const upcoming = plans?.upcoming ?? null

  if (current === null || upcoming === null) {
    return null
  }

  const selected = resolveSelectedPlan(plans, selectedPlanId)

  return selected !== null && selected.id === upcoming.id ? 'this' : 'next'
}

/**
 * The offer is always about a week other than the one on screen. An existing upcoming plan turns it into a
 * way to reach that week, because a second one cannot be created.
 *
 * Viewing the upcoming plan itself therefore leaves nothing to offer: reaching it is where the user already
 * is, and a further week would be a second plan starting after today, which the server refuses. The card
 * gets no action rather than one that reopens the plan already on screen.
 */
export function resolveLastDayAction(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null,
  selectedDayKey: string
): LastDayAction | null {
  const plan = resolveSelectedPlan(plans, selectedPlanId)

  if (plan === null || !isLastPlanDay(selectedDayKey, plan.endDate)) {
    return null
  }

  const upcoming = plans?.upcoming ?? null

  if (upcoming === null) {
    return 'planAnotherWeek'
  }

  return plan.id === upcoming.id ? null : 'viewNextWeek'
}

export function resolveSelectedPlanDate(plan: MealPlan, storedDate: string | null, now: Date): string {
  return storedDate === null
    ? defaultSelectedPlanDate(plan.startDate, plan.endDate, now)
    : clampDayKeyToPlan(storedDate, plan.startDate, plan.endDate)
}

// The weekday of a plan day as the totals overline and the post-log banner read it ('Saturday'). Built from
// the day key's own parts, so a 'YYYY-MM-DD' value is never a UTC instant that names the day before.
export function planDayWeekdayName(dayKey: string): string {
  return format(parseDayKey(dayKey), WEEKDAY_FORMAT)
}

// The empty state's primary action names what answering it will do, which the setup status has already
// decided; the two resume statuses share one label because both continue the same unfinished setup.
export function resolveEmptyPlanCtaLabel(cta: EmptyPlanCta): string {
  if (cta === 'create') {
    return MEAL_PLAN_CREATE_BUTTON_TEXT
  }

  return cta === 'planNextWeek' ? MEAL_PLAN_PLAN_NEXT_WEEK_BUTTON_TEXT : MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT
}

/**
 * The slot as the banner sentence says it, from the label the logging screen captured.
 *
 * That label is a diary bucket's own name, which the server backfills capitalised ('Breakfast'), while the
 * sentence reads "Added to breakfast" — so a canonical bucket name is lower-cased and anything else is left
 * exactly as it is rather than having a name the app did not choose rewritten mid-sentence.
 */
export function slotCopyFromBucketLabel(bucketLabel: string): string {
  const trimmed = bucketLabel.trim()
  const canonical = CANONICAL_BUCKET_LABELS.find(label => label.toLowerCase() === trimmed.toLowerCase())

  return canonical === undefined ? trimmed : canonical.toLowerCase()
}

/**
 * The post-log banner names the slot the entry went to, and the weekday as well when that entry is not on
 * today's date — where "View diary" leads to Macros History rather than the Diary segment, so the day has to
 * be said out loud for the banner to describe where the meal actually landed.
 */
export function formatPostLogBannerBody(dateIso: string, slotLabel: string, todayDayKey: string): string {
  const slot = slotCopyFromBucketLabel(slotLabel)

  if (resolvePostLogViewTarget(dateIso, todayDayKey) === 'diary') {
    return stringWithNamedParameters(MEAL_PLAN_ADDED_TO_SLOT_TEMPLATE, {slot})
  }

  return stringWithNamedParameters(MEAL_PLAN_ADDED_TO_DAY_SLOT_TEMPLATE, {
    weekday: planDayWeekdayName(dateIso),
    slot
  })
}

/**
 * The origin to hold for the banner currently in the store, or `null` when there is no banner.
 *
 * The same object is returned whenever nothing has to change, so a caller adjusting state during render
 * settles after one pass. The plan id and the plan day are bound lazily and TOGETHER: a log resolves while the
 * plan is on screen, but if the store is written a render before the plan resolves, the origin takes both as
 * soon as a plan exists rather than freezing a `null` the comparison below could never match — and the
 * selected day is only a plan day while a plan is on screen (without one the tab falls back to the session's
 * day), so capturing it before then would bind a day the plan does not contain.
 */
export function resolvePostLogBannerOrigin(
  current: PostLogBannerOrigin | null,
  result: PostLogResult | null,
  planId: string | null,
  selectedDayKey: string,
  lastSwapSucceededAt: number
): PostLogBannerOrigin | null {
  if (result === null) {
    return null
  }

  if (current === null || current.entryId !== result.entryId) {
    return {
      entryId: result.entryId,
      planId,
      dayKey: planId === null ? null : selectedDayKey,
      lastSwapSucceededAt
    }
  }

  // The plan can arrive after the entry did, when the log resolved before the week's read: adopting it then is
  // what lets the banner be shown against the plan and day it belongs to instead of staying unattributable.
  // The watermark is carried through unchanged, because this is the same banner, not a newer one.
  if (current.planId === null && planId !== null) {
    return {
      entryId: current.entryId,
      planId,
      dayKey: selectedDayKey,
      lastSwapSucceededAt: current.lastSwapSucceededAt
    }
  }

  return current
}

/**
 * Whether the success banner belongs on the screen as it is right now.
 *
 * Every term is compared at render time, because the banner stands where the totals card does and a frame of
 * it on the wrong day or the wrong plan misreports what was logged. The plan is compared by the id actually
 * on screen rather than by the stored selection, which is `null` for a default-selected plan and therefore
 * equal across a replacement plan covering the same dates.
 *
 * The day is the CAPTURED plan day, never `result.dateIso`: that is the diary date the entry landed on, and a
 * log may target another day of the plan week, in which case comparing it against the selected day cleared
 * the banner 0.1.4 (iii) requires on the very frame it was raised. The diary date still decides the wording
 * and the Diary-versus-History destination — `formatPostLogBannerBody` and `resolveViewTarget` read it — so
 * the two concerns stay on the date each of them is about.
 */
export function isPostLogBannerVisible(inputs: PostLogBannerInputs): boolean {
  const {result, origin, dismissedEntryId, planId, selectedDayKey, lastSwapSucceededAt} = inputs

  if (result === null || origin === null || result.entryId === dismissedEntryId) {
    return false
  }

  if (lastSwapSucceededAt > origin.lastSwapSucceededAt) {
    return false
  }

  return origin.entryId === result.entryId && origin.planId === planId && origin.dayKey === selectedDayKey
}

export function latestLoggedEntry(entries: LoggedEntryRef[]): LoggedEntryRef | null {
  return entries.reduce<LoggedEntryRef | null>(
    (latest, entry) => (latest === null || isLaterEntry(entry, latest) ? entry : latest),
    null
  )
}

/**
 * Read from the logged entries alone. `previousRecipe` records only the most recent swap, so consulting it
 * would lose the meal the user actually ate once a slot has been swapped more than once.
 *
 * One pass: the latest entry and whether the current recipe is among them are decided together, because this
 * runs for every meal of the day and both answers come from the same list.
 */
export function resolveMealLoggedState(meal: MealPlanMeal): MealLoggedState {
  let latest: LoggedEntryRef | null = null
  let isCurrentRecipeLogged = false

  for (const entry of meal.loggedEntries) {
    if (latest === null || isLaterEntry(entry, latest)) {
      latest = entry
    }

    isCurrentRecipeLogged = isCurrentRecipeLogged || entry.recipeVersionId === meal.recipe.versionId
  }

  if (latest === null) {
    return {kind: 'unlogged'}
  }

  return isCurrentRecipeLogged ? {kind: 'logged', entry: latest} : {kind: 'loggedThenSwapped', entry: latest}
}

// The day's meals with their logged state already resolved, so a card re-render costs no derivation and an
// unchanged card can be skipped by identity.
export function buildMealCardModels(day: MealPlanDay): MealCardModel[] {
  return day.meals.map(meal => ({meal, loggedState: resolveMealLoggedState(meal)}))
}

/**
 * The single reason a flagged meal's card states, keyed into the flag copy. Flags that all carry one code name
 * that code's reason; a set whose codes differ can only be stated generically, which is what the fallback reason
 * is for — borrowing one of the specific reasons would tell the user, for instance, that a disliked ingredient
 * is an allergen.
 *
 * A shared code this build has no copy for resolves to that same fallback, because the reason is only ever read
 * to look copy up: a code carried through would leave the caller holding a code with no sentence, which is what
 * crashed the card's render (TypeError on `.split` of an absent template). The codec decodes the code as an open
 * string, so a newer server's fifth code reaches here as itself — and states the generic reason, exactly as the
 * settings banner's `resolveBannerReason` does with `hasBannerCopy`.
 */
export function resolveMealFlagReason(flags: readonly MealPlanFlag[]): string | null {
  const [firstFlag] = flags

  if (firstFlag === undefined) {
    return null
  }

  if (!flags.every(flag => flag.code === firstFlag.code)) {
    return PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON
  }

  return hasMealFlagTemplate(firstFlag.code) ? firstFlag.code : PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON
}

// The one placeholder the flag templates carry. Read rather than substituted when no detail could be formatted,
// because an absent value now renders as nothing: the sentence would read "Contains " with a gap where the
// ingredient belongs, which is worse copy than stating the reason generically.
const MEAL_FLAG_DETAIL_PLACEHOLDER = '{detail}'

// A detail is a server value, so the label read is own-property and string-only (`lookupLabel`): a detail
// naming 'constructor' or '__proto__' resolves to nothing rather than to a function or an object.
//
// All or nothing, here and in the two formatters below, for the same reason the settings banner's formatters
// are: the card states one reason for the whole flag set, so a detail this release cannot state is not a detail
// to quietly drop. Dropping it would leave "Contains milk" on a meal that also carries the detail that was
// discarded, and the user would swap for milk and meet the other one. Null means "state this generically".
const mapFlagSentenceLabels = (labels: Record<string, string>, details: readonly string[]): string[] | null => {
  const labelled = details.map(detail => lookupLabel(labels, detail.trim()))

  return labelled.every((label): label is string => label !== undefined) ? labelled : null
}

// A duration is a count, not a label, so it is stated through the minutes template rather than looked up, and
// the greatest of the set is the one stated: the card names the recipe's own cooking time, and a meal flagged
// twice is stated by the longer of the two. Every detail has to be a positive whole number of minutes for that
// to be true — one that is not leaves a duration unknown, and the greatest of the rest would understate it.
const formatFlagCookingTime = (details: readonly string[]): string[] | null => {
  const minutes = details.map(detail => Number(detail.trim()))

  if (!minutes.every(value => Number.isInteger(value) && value > 0)) {
    return null
  }

  return [stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE, {minutes: Math.max(...minutes)})]
}

// An ingredient name is the one detail that arrives as display text, so it is stated as sent — but a blank one
// names nothing, and the set it belongs to is then as incomplete as an unrecognised code makes it.
const formatFlagIngredientNames = (details: readonly string[]): string[] | null => {
  const names = details.map(detail => detail.trim())

  return names.every(name => name.length > 0) ? names : null
}

// What the server sends as a flag's detail differs per code (backend recipe.logic.ts): the user's own allergen
// and diet codes, the offending ingredients' display names, and the RECIPE's total minutes. Only the dislike
// names are already display text, so every other code is formatted here rather than spliced into the card's
// line as the token it arrived as — which is what rendered "Contains vegan" and "Takes 30". A code this build
// has no formatting for states nothing, which keeps a newer server's flag from reading as a raw value.
const formatMealFlagDetails = (code: string, details: readonly string[]): string[] | null => {
  switch (code) {
    case 'allergen':
      return mapFlagSentenceLabels(MEAL_PLAN_ALLERGEN_SENTENCE_LABELS, details)
    case 'diet':
      return mapFlagSentenceLabels(MEAL_PLAN_DIET_SENTENCE_LABELS, details)
    case 'dislike':
      return formatFlagIngredientNames(details)
    case 'cooking_time':
      return formatFlagCookingTime(details)
    default:
      return null
  }
}

// The details of the card's own reason, formatted for that reason and de-duplicated after formatting, so a meal
// flagged twice for one allergen states it once and the first flag decides the order. A flag carrying no detail
// at all is the same incompleteness as one whose detail cannot be formatted: the reason the card would state is
// not established, so it states the generic copy.
const resolveMealFlagDetail = (reason: string, flags: readonly MealPlanFlag[]): string | null => {
  const reasonFlags = flags.filter(flag => flag.code === reason)

  if (reasonFlags.length === 0 || reasonFlags.some(flag => flag.detail.length === 0)) {
    return null
  }

  const formatted = formatMealFlagDetails(
    reason,
    reasonFlags.flatMap(flag => flag.detail)
  )

  if (formatted === null) {
    return null
  }

  const distinct = Array.from(new Set(formatted))

  return distinct.length > 0 ? distinct.join(MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR) : null
}

/**
 * The line a flagged meal's card states, or null when the meal carries no flags — null is "this meal is not
 * flagged", and every flagged meal gets a line, so the card's flagged treatment follows this answer.
 *
 * The reason above chooses the sentence and this formats the detail it needs, per code and all or nothing. The
 * generic sentence is the answer whenever the specific one cannot be completed: an unrecognised code, codes that
 * differ, a detail this build cannot state, or no detail at all. Never a sentence with a gap in it.
 */
export function resolveMealFlagLine(flags: readonly MealPlanFlag[]): string | null {
  const reason = resolveMealFlagReason(flags)

  if (reason === null) {
    return null
  }

  const template = mealFlagTemplate(reason)
  const detail = resolveMealFlagDetail(reason, flags)

  if (detail === null) {
    return template.includes(MEAL_FLAG_DETAIL_PLACEHOLDER) ? MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT : template
  }

  return stringWithNamedParameters(template, {detail})
}

/**
 * The planned-totals unit line for a day of `count` meals. A one-meal day is a real day — a schedule with one
 * slot, or a day swapped down to one — and "kcal across 1 meals" is not copy this app ships. Zero keeps the
 * plural, which is how English counts nothing.
 */
export function mealCountUnitText(count: number): string {
  const template = count === 1 ? MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE : MEAL_PLAN_MEAL_COUNT_TEMPLATE

  return stringWithNamedParameters(template, {n: count})
}

// The Diary-versus-History rule is shared with the post-log banner on the logging screen, so it lives in
// @utility/MealPlanDateUtility and this tab only re-exports it under the name its callers use.
export {resolvePostLogViewTarget as resolveViewTarget}

// Resuming setup is offered here and by the introduction's returning-user CTA, so the resolver lives in
// @utility/MealPlanSetupResumeUtility; this tab re-exports it for the same reason it re-exports the rule above.
export {resolveSetupResumeTarget}

export type {SetupResumeTarget}

// The width one of `itemCount` equally flexed siblings takes inside `availableWidth`, once the gaps between
// them are removed.
export function flexItemWidth(availableWidth: number, gap: number, itemCount: number): number {
  if (availableWidth <= 0 || itemCount <= 0) {
    return 0
  }

  return Math.max(0, (availableWidth - gap * (itemCount - 1)) / itemCount)
}
