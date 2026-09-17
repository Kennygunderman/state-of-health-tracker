import {MacroTotals} from '@data/models/Macros'
import {MealSlot, RecipeIngredient} from '@data/models/Recipe'
import {SwapPreview} from '@data/models/SwapAlternative'
import {buildPendingIntent, MealPlanStore, PendingIntent, PENDING_INTENT_TTL_MS} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {matchesFingerprint, requestBody, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {AxiosError, AxiosResponse} from 'axios'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE,
  MEAL_SLOT_SENTENCE_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  SWAP_PREVIEW_REPLACING_TEMPLATE,
  SWAP_PREVIEW_SUBTITLE_SEPARATOR,
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE
} from '@constants/strings'

import {
  buildSwapMacroLegend,
  buildThisMealMetrics,
  calorieProgressRatio,
  deriveCalorieDelta,
  formatPreviewSubtitle,
  formatReplacingContext,
  isOutcomeOwnedBySwapMeal,
  resolveCommitFailureDisposition,
  resolvePreviewIngredients,
  resolveSwapCommitGate,
  resolveSwapCommitLaunch,
  resolveSwapSlotOwnership,
  SwapCommitGateInput,
  SwapCommitLaunchInput
} from '../index.util'

// Mocking the persist adapter keeps the suite free of native modules: `index.util` imports the store module for
// its pure slot-ownership and keyed-request API, and importing that module creates the persisted store.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const MINUS_SIGN = '\u2212'
const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const PLAN_ID = 'plan-1'
const MEAL_ID = 'meal-1'
const NOW = 1_760_000_000_000
const STORED_KEY = 'idem-stored'
const FRESH_KEY = 'idem-fresh'
const OPENED_REVISION = 4
const TARGET_CALORIES = 2100
const DAY_KEY = '2025-07-05'
const DAY_TEXT = 'Sat Jul 5'
const DAY_WEEKDAY = 'Sat'
const DAY_DATE = 'Jul 5'
const KNOWN_SLOT: MealSlot = 'lunch'
const KNOWN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const UNKNOWN_SLOT = 'brunch'
const PROTOTYPE_MEMBER_SLOTS = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'toLocaleString',
  'valueOf',
  '__proto__',
  '__defineGetter__'
]
const PORTION_TEXT = '1 serving (320 g)'
const PLAN_REVISION = 7
const WHOLE_RECIPE_DISPLAY_TEXT = '1 1/2 cups'

const DAY_KEYS = [
  {key: DAY_KEY, text: DAY_TEXT},
  {key: '2026-07-01', text: 'Wed Jul 1'},
  {key: '2026-01-01', text: 'Thu Jan 1'},
  {key: '2026-12-31', text: 'Thu Dec 31'}
]

const DAY_TOTALS: MacroTotals = {calories: 1780, protein: 135, carbs: 190, fat: 58}

const TARGETS: MacroTotals = {calories: TARGET_CALORIES, protein: 146, carbs: 210, fat: 64}

const MEAL_NUTRITION: MacroTotals = {calories: 612, protein: 41, carbs: 52, fat: 18}

type PreviewTargets = SwapPreview['targets']

const makeDayTotals = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...DAY_TOTALS, ...overrides})

const makeNutrition = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...MEAL_NUTRITION, ...overrides})

const makeTargets = (overrides: Partial<PreviewTargets> = {}): PreviewTargets => ({...TARGETS, ...overrides})

const replacingText = (slotLabel: string, dateText: string = DAY_TEXT): string =>
  SWAP_PREVIEW_REPLACING_TEMPLATE.replace('{slot}', slotLabel).replace('{date}', dateText)

const minutesText = (minutes: number): string =>
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE.replace('{minutes}', String(minutes))

const makeCommitGateInput = (overrides: Partial<SwapCommitGateInput> = {}): SwapCommitGateInput => ({
  ownership: 'free',
  isHydrated: true,
  isCommitInFlight: false,
  isPlanWritable: true,
  dayPlanRevision: PLAN_REVISION,
  previewPlanRevision: PLAN_REVISION,
  isPreviewFetching: false,
  ...overrides
})

const axiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

const apiError = (status?: number, code?: string): AxiosError =>
  axiosError(status, code === undefined ? {} : {error: code})

const makeIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Chicken breast',
  quantity: 2,
  unit: 'cup',
  gramWeight: 480,
  displayText: WHOLE_RECIPE_DISPLAY_TEXT,
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

const swapSnapshot = (overrides: Partial<Omit<SwapRequestSnapshot, 'action'>> = {}): SwapRequestSnapshot => ({
  action: 'swap',
  planId: PLAN_ID,
  mealId: MEAL_ID,
  recipeVersionId: 'recipe-version-bowl',
  portionMultiplier: 1,
  expectedPlanRevision: OPENED_REVISION,
  ...overrides
})

const storedIntent = (snapshot: SwapRequestSnapshot = swapSnapshot(), userId: string = USER_ID): PendingIntent =>
  buildPendingIntent(snapshot, STORED_KEY, userId, NOW)

const stateWith = (intent: PendingIntent | null): Pick<MealPlanStore, 'pendingIntents'> => ({
  pendingIntents: intent === null ? {} : {swap: intent}
})

// Ownership as the screen asks it: for the plan and meal this preview commits against.
const ownershipFor = (intent: PendingIntent | null, userId: string | null = USER_ID, now: number = NOW) =>
  resolveSwapSlotOwnership({state: stateWith(intent), userId, planId: PLAN_ID, mealId: MEAL_ID, now})

describe('resolveCommitFailureDisposition', () => {
  it('retires the key on a confirmed swap_failed and keeps the 13e assurance for the screen to draw', () => {
    // A confirmed 502 swap_failed persisted nothing (AAP 0.5.2), so the action has been answered: the intent is
    // resolved and the retry this screen still offers must mint a fresh key rather than reuse a spent one.
    expect(resolveCommitFailureDisposition(apiError(502, API_ERROR_CODES.swapFailed))).toEqual({
      failure: 'confirmed',
      retainsPendingIntent: false
    })
  })

  it('keeps the key only for an outcome nothing described', () => {
    const noResponse = resolveCommitFailureDisposition(axiosError())
    const undecodableBody = resolveCommitFailureDisposition(axiosError(502, '<html>Bad gateway</html>'))
    const unrecognisedServerCode = resolveCommitFailureDisposition(apiError(503, 'Failed to swap meal'))

    // Each of these may have committed before its response was lost, which leaves that key the only way to ask
    // again without risking a second swap (AAP 0.7.2).
    expect(noResponse).toEqual({failure: 'unconfirmed', retainsPendingIntent: true})
    expect(undecodableBody).toEqual({failure: 'unconfirmed', retainsPendingIntent: true})
    expect(unrecognisedServerCode).toEqual({failure: 'unconfirmed', retainsPendingIntent: true})
  })

  it('retires the key on every other confirmed refusal and draws none of them in place', () => {
    const confirmedCodes = [
      API_ERROR_CODES.previewStale,
      API_ERROR_CODES.recipeIneligible,
      API_ERROR_CODES.stalePlan,
      API_ERROR_CODES.planNotActive,
      API_ERROR_CODES.idempotencyConflict,
      API_ERROR_CODES.invalidRequest
    ]

    confirmedCodes.forEach(code => {
      // The code's own recovery — a toast plus a way out of this screen — is what the user meets, so there is
      // no failure state to draw here; the key is spent either way.
      expect(resolveCommitFailureDisposition(apiError(409, code))).toEqual({
        failure: null,
        retainsPendingIntent: false
      })
    })

    expect(resolveCommitFailureDisposition(apiError(503, API_ERROR_CODES.featureDisabled))).toEqual({
      failure: null,
      retainsPendingIntent: false
    })
  })
})

describe('resolveSwapSlotOwnership', () => {
  it("reports this plan and meal's own unresolved commit as mine, and an empty slot as free", () => {
    expect(ownershipFor(storedIntent())).toBe('mine')
    expect(ownershipFor(null)).toBe('free')
  })

  it('reports a record for another meal or another plan as FOREIGN rather than as an empty slot', () => {
    // The distinction the whole gate rests on: a scoped lookup answers null for both, and minting on that null
    // is what abandoned the only key that could reconcile the other meal's write (0.7.2).
    expect(ownershipFor(storedIntent(swapSnapshot({mealId: 'meal-other'})))).toBe('foreign')
    expect(ownershipFor(storedIntent(swapSnapshot({planId: 'plan-other'})))).toBe('foreign')
  })

  it('reports an expired record, another account and no signed-in account as free', () => {
    expect(ownershipFor(storedIntent(), USER_ID, NOW + PENDING_INTENT_TTL_MS)).toBe('free')
    expect(ownershipFor(storedIntent(swapSnapshot(), OTHER_USER_ID))).toBe('free')
    expect(ownershipFor(storedIntent(), null)).toBe('free')
  })
})

describe('resolveSwapCommitGate', () => {
  describe('everything in hand', () => {
    it('offers the commit on a free slot, a read slice, an answered verdict and the revisions bound', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput())).toEqual({
        isCommitDisabled: false,
        isCommitPending: false,
        showsForeignHoldNotice: false,
        isWriteRefused: false,
        isAwaitingWriteVerdict: false
      })
    })
  })

  describe('the one swap slot, and the persisted slice it is read from', () => {
    it("offers it for this request's own unresolved key, which the press replays rather than replaces", () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({ownership: 'mine'}))

      expect(gate.isCommitDisabled).toBe(false)
      expect(gate.isCommitPending).toBe(false)
      expect(gate.showsForeignHoldNotice).toBe(false)
    })

    it('closes it while ANOTHER plan or meal holds the slot, and says so rather than sitting inert', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({ownership: 'foreign'}))).toEqual({
        isCommitDisabled: true,
        isCommitPending: false,
        showsForeignHoldNotice: true,
        isWriteRefused: false,
        isAwaitingWriteVerdict: false
      })
    })

    it('closes it and reads pending while the persisted slice is unknown, whoever holds the slot', () => {
      const ownerships: SwapCommitGateInput['ownership'][] = ['free', 'mine', 'foreign']

      // A pending read and a refused one are both unhydrated, and an unread slice may already hold a key: the
      // CTA states that it is not ready instead of minting beside a record nobody has seen.
      ownerships.forEach(ownership => {
        const gate = resolveSwapCommitGate(makeCommitGateInput({ownership, isHydrated: false}))

        expect(gate.isCommitDisabled).toBe(true)
        expect(gate.isCommitPending).toBe(true)
        expect(gate.showsForeignHoldNotice).toBe(false)
      })
    })

    it('closes it and reads pending while any swap commit is on the wire, whichever screen sent it', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({isCommitInFlight: true}))

      expect(gate.isCommitDisabled).toBe(true)
      expect(gate.isCommitPending).toBe(true)
      expect(gate.showsForeignHoldNotice).toBe(false)
    })

    it('takes hydration before the holder, so an unread slice never explains itself as another meal', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({ownership: 'foreign', isHydrated: false}))

      expect(gate.showsForeignHoldNotice).toBe(false)
      expect(gate.isCommitPending).toBe(true)
    })

    it('closes the commit for a foreign holder even while the verdict and the revisions are in hand', () => {
      // The two halves are independent: a slot this screen does not own is a refusal of its own, and the
      // notice is the only thing on screen that accounts for the disabled CTA.
      const gate = resolveSwapCommitGate(makeCommitGateInput({ownership: 'foreign'}))

      expect(gate.isCommitDisabled).toBe(true)
      expect(gate.isWriteRefused).toBe(false)
      expect(gate.isAwaitingWriteVerdict).toBe(false)
    })
  })

  describe('the writeability verdict', () => {
    it('refuses the commit and reports the refusal on an answered false', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({isPlanWritable: false}))).toEqual({
        isCommitDisabled: true,
        isCommitPending: false,
        showsForeignHoldNotice: false,
        isWriteRefused: true,
        isAwaitingWriteVerdict: false
      })
    })

    it('neither offers the write nor claims a refusal for the cache-seeded null verdict', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({isPlanWritable: null}))).toEqual({
        isCommitDisabled: true,
        isCommitPending: false,
        showsForeignHoldNotice: false,
        isWriteRefused: false,
        isAwaitingWriteVerdict: true
      })
    })

    it('treats an absent envelope exactly as an unanswered verdict', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({isPlanWritable: undefined}))).toEqual({
        isCommitDisabled: true,
        isCommitPending: false,
        showsForeignHoldNotice: false,
        isWriteRefused: false,
        isAwaitingWriteVerdict: true
      })
    })

    it('reports the refusal even while a commit of its own is in flight', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({isPlanWritable: false, isCommitInFlight: true}))

      expect(gate.isWriteRefused).toBe(true)
      expect(gate.isCommitDisabled).toBe(true)
    })

    it('still reports an unanswered verdict while the preview is being re-read', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({isPlanWritable: null, isPreviewFetching: true}))

      expect(gate.isAwaitingWriteVerdict).toBe(true)
      expect(gate.isWriteRefused).toBe(false)
    })

    it('never reads the three states as overlapping', () => {
      const verdicts: (boolean | null | undefined)[] = [true, false, null, undefined]

      verdicts.forEach(isPlanWritable => {
        const gate = resolveSwapCommitGate(makeCommitGateInput({isPlanWritable}))

        expect(gate.isWriteRefused && gate.isAwaitingWriteVerdict).toBe(false)
        expect(!gate.isCommitDisabled && (gate.isWriteRefused || gate.isAwaitingWriteVerdict)).toBe(false)
      })
    })
  })

  describe('the two plan revisions', () => {
    it('bars the commit while the day reports a revision ahead of the preview', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({dayPlanRevision: PLAN_REVISION + 1}))

      expect(gate.isCommitDisabled).toBe(true)
      expect(gate.isWriteRefused).toBe(false)
    })

    it('bars the commit for a day revision behind the preview just as firmly', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({dayPlanRevision: PLAN_REVISION - 1})).isCommitDisabled).toBe(
        true
      )
    })

    it('bars the commit while the day revision is unknown', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({dayPlanRevision: undefined})).isCommitDisabled).toBe(true)
      expect(resolveSwapCommitGate(makeCommitGateInput({dayPlanRevision: null})).isCommitDisabled).toBe(true)
    })

    it('bars the commit while the preview revision is unknown', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({previewPlanRevision: undefined})).isCommitDisabled).toBe(true)
      expect(resolveSwapCommitGate(makeCommitGateInput({previewPlanRevision: null})).isCommitDisabled).toBe(true)
    })

    it('never treats a revision that arrived as NaN as a match', () => {
      const gate = resolveSwapCommitGate(
        makeCommitGateInput({dayPlanRevision: Number.NaN, previewPlanRevision: Number.NaN})
      )

      expect(gate.isCommitDisabled).toBe(true)
    })

    it('enables the commit at revision zero, which is a real revision', () => {
      const gate = resolveSwapCommitGate(makeCommitGateInput({dayPlanRevision: 0, previewPlanRevision: 0}))

      expect(gate.isCommitDisabled).toBe(false)
    })
  })

  describe('a request already in flight', () => {
    it('bars the commit while the revision-rebinding preview refetch has not settled', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({isPreviewFetching: true})).isCommitDisabled).toBe(true)
    })

    it('bars a second commit while the first is still pending', () => {
      expect(resolveSwapCommitGate(makeCommitGateInput({isCommitInFlight: true})).isCommitDisabled).toBe(true)
    })
  })

  describe('purity', () => {
    it('does not mutate the input it was handed', () => {
      const input = makeCommitGateInput({isPlanWritable: null})
      const snapshot = JSON.stringify(input)

      resolveSwapCommitGate(input)

      expect(JSON.stringify(input)).toBe(snapshot)
    })
  })
})

describe('isOutcomeOwnedBySwapMeal', () => {
  describe('an outcome nothing described', () => {
    it('hands back a rejection that never reached a response', () => {
      expect(isOutcomeOwnedBySwapMeal(axiosError())).toBe(true)
    })

    it('hands back a 5xx carrying no recognised machine code', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(502, 'something_unrecognised'))).toBe(true)
    })

    it('hands back a gateway 5xx with no body to decode', () => {
      expect(isOutcomeOwnedBySwapMeal(axiosError(504))).toBe(true)
      expect(isOutcomeOwnedBySwapMeal(axiosError(500, '<html>gateway</html>'))).toBe(true)
    })

    it('hands back a 5xx that merely echoes a 4xx code, which is unknown rather than confirmed', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(500, API_ERROR_CODES.previewStale))).toBe(true)
      expect(isOutcomeOwnedBySwapMeal(apiError(500, API_ERROR_CODES.stalePlan))).toBe(true)
    })
  })

  describe('the confirmed refusals SwapMeal draws', () => {
    it('hands back a confirmed swap_failed, which is the 13e same-key retry', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(502, API_ERROR_CODES.swapFailed))).toBe(true)
    })

    it('hands back preview_stale, whose revision the alternatives were computed for', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(409, API_ERROR_CODES.previewStale))).toBe(true)
    })

    it('hands back recipe_ineligible, which contradicts the candidate that was chosen', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(422, API_ERROR_CODES.recipeIneligible))).toBe(true)
    })
  })

  describe('the outcomes this screen still answers for', () => {
    it('keeps the two plan-state refusals, which leave the flow for the Meal Plan tab', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(409, API_ERROR_CODES.stalePlan))).toBe(false)
      expect(isOutcomeOwnedBySwapMeal(apiError(409, API_ERROR_CODES.planNotActive))).toBe(false)
    })

    it('keeps feature_disabled, which leaves for the unavailable card', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(503, API_ERROR_CODES.featureDisabled))).toBe(false)
    })

    it('keeps idempotency_conflict, whose key is retired here', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(409, API_ERROR_CODES.idempotencyConflict))).toBe(false)
    })

    it('keeps a confirmed refusal this release ships no swap recovery for', () => {
      expect(isOutcomeOwnedBySwapMeal(apiError(400, API_ERROR_CODES.invalidRequest))).toBe(false)
      expect(isOutcomeOwnedBySwapMeal(apiError(404, 'Plan not found'))).toBe(false)
    })
  })

  describe('nothing to attribute', () => {
    it('keeps a rejection that carried no value at all', () => {
      expect(isOutcomeOwnedBySwapMeal(null)).toBe(false)
      expect(isOutcomeOwnedBySwapMeal(undefined)).toBe(false)
    })
  })
})

describe('resolveSwapCommitLaunch', () => {
  const launchFor = (overrides: Partial<SwapCommitLaunchInput> = {}) =>
    resolveSwapCommitLaunch({
      state: stateWith(null),
      request: swapSnapshot(),
      userId: USER_ID,
      isHydrated: true,
      isCommitInFlight: false,
      attemptedAt: NOW,
      freshKey: FRESH_KEY,
      ...overrides
    })

  it('mints and records when the slot is empty', () => {
    const launch = launchFor()

    expect(launch).toEqual({
      kind: 'send',
      isReplay: false,
      payload: requestBody(swapSnapshot(), FRESH_KEY),
      intent: buildPendingIntent(swapSnapshot(), FRESH_KEY, USER_ID, NOW)
    })
  })

  it('replays the STORED snapshot under the STORED key when the request still fingerprints to the record', () => {
    const stored = storedIntent()
    const launch = launchFor({state: stateWith(stored)})

    // Byte-identical, which is the only thing the server answers with the stored result: a rebuilt body earns
    // `409 idempotency_conflict` or commits a second swap (0.7.2).
    expect(launch).toEqual({
      kind: 'send',
      isReplay: true,
      payload: requestBody(stored.request, STORED_KEY),
      intent: buildPendingIntent(stored.request, STORED_KEY, USER_ID, NOW)
    })

    if (launch.kind === 'send') {
      expect(launch.intent?.key).toBe(STORED_KEY)
      expect(matchesFingerprint(stored.request, stored.fingerprint)).toBe(true)
    }
  })

  /**
   * The verifier's cold start: the process died with meal A's commit unresolved, the mutation cache came back
   * empty, the user opened meal B and pressed "Use this meal". Everything the decision knows comes out of the
   * persisted slice, and the one thing it must never do is mint a second key over meal A's.
   */
  it('blocks a commit on meal B while meal A holds the slot, recording and sending nothing', () => {
    const launch = launchFor({
      state: stateWith(storedIntent(swapSnapshot({mealId: 'meal-a', recipeVersionId: 'recipe-version-soup'}))),
      request: swapSnapshot({mealId: 'meal-b'})
    })

    expect(launch).toEqual({kind: 'blocked', reason: 'otherResource'})
    expect(launch).not.toHaveProperty('payload')
    expect(launch).not.toHaveProperty('intent')
  })

  it('blocks a commit against another plan while this account holds an unresolved swap', () => {
    const launch = launchFor({
      state: stateWith(storedIntent(swapSnapshot({planId: 'plan-old'}))),
      request: swapSnapshot({planId: 'plan-new'})
    })

    expect(launch).toEqual({kind: 'blocked', reason: 'otherResource'})
  })

  it('blocks every launch while the persisted slice is unread, so nothing is minted beside an unseen key', () => {
    expect(launchFor({isHydrated: false})).toEqual({kind: 'blocked', reason: 'hydrating'})
    expect(launchFor({isHydrated: false, state: stateWith(storedIntent())})).toEqual({
      kind: 'blocked',
      reason: 'hydrating'
    })
  })

  it('blocks a launch while a swap is already on the wire, whichever screen put it there', () => {
    expect(launchFor({isCommitInFlight: true})).toEqual({kind: 'blocked', reason: 'inFlight'})
  })

  it('takes hydration before the holder, and the holder before a replay', () => {
    const foreign = stateWith(storedIntent(swapSnapshot({mealId: 'meal-a'})))

    expect(launchFor({state: foreign, isHydrated: false})).toEqual({kind: 'blocked', reason: 'hydrating'})
    expect(launchFor({state: foreign, isCommitInFlight: true})).toEqual({kind: 'blocked', reason: 'inFlight'})
    expect(launchFor({state: stateWith(storedIntent()), isCommitInFlight: true})).toEqual({
      kind: 'blocked',
      reason: 'inFlight'
    })
  })

  it('mints over a record for this very meal whose request has changed, because that key is spent', () => {
    // A refreshed preview or a moved revision is a different request, and the server refuses a reused key with
    // a changed fingerprint (`409 idempotency_conflict`), so the stored key may not be replayed (0.5.1).
    const launch = launchFor({
      state: stateWith(storedIntent(swapSnapshot({portionMultiplier: 1.5}))),
      request: swapSnapshot({portionMultiplier: 1})
    })

    expect(launch).toEqual({
      kind: 'send',
      isReplay: false,
      payload: requestBody(swapSnapshot({portionMultiplier: 1}), FRESH_KEY),
      intent: buildPendingIntent(swapSnapshot({portionMultiplier: 1}), FRESH_KEY, USER_ID, NOW)
    })
  })

  it('sends under a fresh key without a record when no account is signed in', () => {
    // `pendingIntents` is keyed by user, so there is nothing to scope a record to; another account's record is
    // not this caller's slot and must not block them either.
    const launch = launchFor({userId: null, state: stateWith(storedIntent(swapSnapshot(), OTHER_USER_ID))})

    expect(launch).toEqual({
      kind: 'send',
      isReplay: false,
      payload: requestBody(swapSnapshot(), FRESH_KEY),
      intent: null
    })
  })

  it('treats an expired record as an empty slot rather than as a holder', () => {
    const launch = launchFor({state: stateWith(storedIntent()), attemptedAt: NOW + PENDING_INTENT_TTL_MS})

    expect(launch).toEqual({
      kind: 'send',
      isReplay: false,
      payload: requestBody(swapSnapshot(), FRESH_KEY),
      intent: buildPendingIntent(swapSnapshot(), FRESH_KEY, USER_ID, NOW + PENDING_INTENT_TTL_MS)
    })
  })

  it('leaves the state it was given untouched', () => {
    const state = stateWith(storedIntent())
    const snapshot = JSON.stringify(state)

    launchFor({state})

    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('deriveCalorieDelta', () => {
  describe('a swap that lowers the day', () => {
    it('signs the reduction with a true minus and the negative tone', () => {
      expect(deriveCalorieDelta(-70)).toEqual({text: `${MINUS_SIGN}70 ${CAL_LABEL}`, tone: 'negative'})
    })

    it('never draws an ASCII hyphen in the pill', () => {
      const delta = deriveCalorieDelta(-70)

      expect(delta?.text).toContain(MINUS_SIGN)
      expect(delta?.text).not.toContain('-')
    })

    it('groups a four-figure reduction behind the minus', () => {
      expect(deriveCalorieDelta(-1200)?.text).toBe(`${MINUS_SIGN}1,200 ${CAL_LABEL}`)
    })
  })

  describe('a swap that raises the day', () => {
    it('signs the increase with a leading plus and the positive tone', () => {
      expect(deriveCalorieDelta(320)).toEqual({text: `+320 ${CAL_LABEL}`, tone: 'positive'})
    })

    it('groups a four-figure increase with a thousands separator', () => {
      expect(deriveCalorieDelta(1200)?.text).toBe(`+1,200 ${CAL_LABEL}`)
    })
  })

  describe('nothing worth drawing', () => {
    it('has no pill for a swap that leaves the day unchanged', () => {
      expect(deriveCalorieDelta(0)).toBeNull()
    })

    it('has no pill for sub-calorie dust in either direction', () => {
      expect(deriveCalorieDelta(0.4)).toBeNull()
      expect(deriveCalorieDelta(-0.4)).toBeNull()
    })

    it('has no pill for a delta that never arrived as a number', () => {
      expect(deriveCalorieDelta(Number.NaN)).toBeNull()
      expect(deriveCalorieDelta(Number.POSITIVE_INFINITY)).toBeNull()
      expect(deriveCalorieDelta(Number.NEGATIVE_INFINITY)).toBeNull()
    })
  })

  describe('rounding', () => {
    it('rounds a half calorie symmetrically in both directions', () => {
      expect(deriveCalorieDelta(-69.5)?.text).toBe(`${MINUS_SIGN}70 ${CAL_LABEL}`)
      expect(deriveCalorieDelta(69.5)?.text).toBe(`+70 ${CAL_LABEL}`)
    })

    it('rounds a half calorie up to the first drawable pill rather than away to nothing', () => {
      expect(deriveCalorieDelta(-0.5)).toEqual({text: `${MINUS_SIGN}1 ${CAL_LABEL}`, tone: 'negative'})
    })
  })
})

describe('calorieProgressRatio', () => {
  describe('a usable target', () => {
    it('reports half the target as a half fill', () => {
      expect(calorieProgressRatio(1050, TARGET_CALORIES)).toBe(0.5)
    })

    it('reports a part-way day as its true fraction of the target', () => {
      expect(calorieProgressRatio(683, TARGET_CALORIES)).toBeCloseTo(683 / TARGET_CALORIES)
    })

    it('reports an empty day as no fill', () => {
      expect(calorieProgressRatio(0, TARGET_CALORIES)).toBe(0)
    })

    it('fills the track exactly at the target', () => {
      expect(calorieProgressRatio(TARGET_CALORIES, TARGET_CALORIES)).toBe(1)
    })

    it('caps a day over the target at a full track', () => {
      expect(calorieProgressRatio(3200, TARGET_CALORIES)).toBe(1)
    })
  })

  describe('a negative day total', () => {
    it('clamps to no fill rather than inverting the bar', () => {
      expect(calorieProgressRatio(-400, TARGET_CALORIES)).toBe(0)
    })

    it('clamps a total more negative than the target itself', () => {
      expect(calorieProgressRatio(-5000, TARGET_CALORIES)).toBe(0)
    })
  })

  describe('an unusable target', () => {
    it('reports no fill when no target arrived', () => {
      expect(calorieProgressRatio(1050, null)).toBe(0)
      expect(calorieProgressRatio(1050, undefined)).toBe(0)
    })

    it('returns a finite zero rather than dividing by a zero target', () => {
      const ratio = calorieProgressRatio(1050, 0)

      expect(ratio).toBe(0)
      expect(Number.isFinite(ratio)).toBe(true)
    })

    it('returns a finite zero for a negative target', () => {
      const ratio = calorieProgressRatio(1050, -TARGET_CALORIES)

      expect(ratio).toBe(0)
      expect(Number.isFinite(ratio)).toBe(true)
    })

    it('returns a finite zero for a target that never arrived as a number', () => {
      const ratio = calorieProgressRatio(1050, Number.NaN)

      expect(ratio).toBe(0)
      expect(Number.isFinite(ratio)).toBe(true)
    })
  })

  describe('a day total that is not a number', () => {
    it('reports no fill for NaN and either infinity', () => {
      expect(calorieProgressRatio(Number.NaN, TARGET_CALORIES)).toBe(0)
      expect(calorieProgressRatio(Number.POSITIVE_INFINITY, TARGET_CALORIES)).toBe(0)
      expect(calorieProgressRatio(Number.NEGATIVE_INFINITY, TARGET_CALORIES)).toBe(0)
    })
  })

  describe('the promised range', () => {
    it('lands inside 0-1 for every total the day could hold', () => {
      const totals = [-Number.MAX_SAFE_INTEGER, -5000, -1, -0.5, 0, 1, 1050, TARGET_CALORIES, 2100.5, 9000]

      totals.forEach(total => {
        const ratio = calorieProgressRatio(total, TARGET_CALORIES)

        expect(Number.isFinite(ratio)).toBe(true)
        expect(ratio).toBeGreaterThanOrEqual(0)
        expect(ratio).toBeLessThanOrEqual(1)
      })
    })
  })
})

describe('buildSwapMacroLegend', () => {
  describe('a complete target set', () => {
    it('pairs each macro with its target in protein, carb, fat order', () => {
      expect(buildSwapMacroLegend(makeDayTotals(), makeTargets())).toEqual([
        {key: 'protein', valueText: '135 / 146g'},
        {key: 'carbs', valueText: '190 / 210g'},
        {key: 'fat', valueText: '58 / 64g'}
      ])
    })

    it('returns exactly the three macro rows', () => {
      expect(buildSwapMacroLegend(makeDayTotals(), makeTargets()).map(item => item.key)).toEqual([
        'protein',
        'carbs',
        'fat'
      ])
    })

    it('rounds both sides of the pair to whole grams', () => {
      const legend = buildSwapMacroLegend(makeDayTotals({protein: 134.6}), makeTargets({protein: 145.5}))
      const [protein] = legend

      expect(protein.valueText).toBe('135 / 146g')
    })

    it('pairs a zero target instead of reading it as unset', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({fat: 0}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190 / 210g', '58 / 0g'])
    })
  })

  describe('a target that never arrived as a usable number', () => {
    it('renders the actual alone instead of pairing it with an invented zero', () => {
      const [protein] = buildSwapMacroLegend(makeDayTotals(), makeTargets({protein: Number.NaN}))

      expect(protein).toEqual({key: 'protein', valueText: '135g'})
      expect(protein.valueText).not.toContain('/')
      expect(protein.valueText).not.toContain('0g')
      expect(protein.valueText).not.toContain('NaN')
    })

    it('degrades every row when no target is usable', () => {
      const targets = makeTargets({
        protein: Number.NaN,
        carbs: Number.POSITIVE_INFINITY,
        fat: Number.NEGATIVE_INFINITY
      })

      expect(buildSwapMacroLegend(makeDayTotals(), targets).map(item => item.valueText)).toEqual([
        '135g',
        '190g',
        '58g'
      ])
    })

    it('leaves the rows with a usable target paired', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({carbs: Number.NaN}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190g', '58 / 64g'])
    })

    it('never renders an infinity in place of a target', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({fat: Number.POSITIVE_INFINITY}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190 / 210g', '58g'])
      expect(legend[2].valueText).not.toContain('Infinity')
    })
  })

  describe('purity', () => {
    it('leaves the totals and targets it was handed untouched', () => {
      const dayTotals = makeDayTotals()
      const targets = makeTargets()
      const snapshot = JSON.parse(JSON.stringify({dayTotals, targets}))

      buildSwapMacroLegend(dayTotals, targets)

      expect(JSON.parse(JSON.stringify({dayTotals, targets}))).toEqual(snapshot)
    })
  })
})

describe('buildThisMealMetrics', () => {
  it('lists the four metrics in calorie, protein, carb, fat order', () => {
    expect(buildThisMealMetrics(makeNutrition())).toEqual([
      {caption: CAL_LABEL, value: '612'},
      {caption: PROTEIN_LABEL, value: '41g'},
      {caption: CARBS_LABEL, value: '52g'},
      {caption: FAT_LABEL, value: '18g'}
    ])
  })

  it('returns a genuine four-tuple', () => {
    expect(buildThisMealMetrics(makeNutrition())).toHaveLength(4)
  })

  it('captions every cell from the shared macro labels', () => {
    expect(buildThisMealMetrics(makeNutrition()).map(item => item.caption)).toEqual([
      CAL_LABEL,
      PROTEIN_LABEL,
      CARBS_LABEL,
      FAT_LABEL
    ])
  })

  it('groups a four-figure calorie count with a thousands separator', () => {
    const [calories] = buildThisMealMetrics(makeNutrition({calories: 1234.6}))

    expect(calories.value).toBe('1,235')
  })

  it('rounds every macro to whole grams', () => {
    const metrics = buildThisMealMetrics(makeNutrition({protein: 41.4, carbs: 52.6, fat: 17.5}))

    expect(metrics.map(item => item.value)).toEqual(['612', '41g', '53g', '18g'])
  })
})

describe('formatReplacingContext', () => {
  describe('a slot the app knows', () => {
    it('reads as the natural-case sentence the hero pill uppercases itself', () => {
      expect(formatReplacingContext(KNOWN_SLOT, DAY_KEY)).toBe('Replacing lunch · Sat Jul 5')
    })

    it('names every known slot through its sentence label', () => {
      expect(KNOWN_SLOTS.map(slot => formatReplacingContext(slot, DAY_KEY))).toEqual(
        KNOWN_SLOTS.map(slot => replacingText(MEAL_SLOT_SENTENCE_LABELS[slot]))
      )
    })

    it('leaves the sentence in natural case', () => {
      const context = formatReplacingContext('breakfast', DAY_KEY)

      expect(context).toContain('breakfast')
      expect(context).not.toBe(context.toUpperCase())
    })
  })

  describe('a slot code the app does not know', () => {
    it('drops the slot segment and keeps the day', () => {
      expect(formatReplacingContext(UNKNOWN_SLOT, DAY_KEY)).toBe(DAY_TEXT)
    })

    it('never interpolates the raw code, an unfilled placeholder or undefined', () => {
      const context = formatReplacingContext(UNKNOWN_SLOT, DAY_KEY)

      expect(context).not.toContain(UNKNOWN_SLOT)
      expect(context).not.toContain('{slot}')
      expect(context).not.toContain('undefined')
    })

    it('drops the segment for an empty slot code as well', () => {
      expect(formatReplacingContext('', DAY_KEY)).toBe(DAY_TEXT)
    })

    it('keeps the very day segment a known slot would have shown', () => {
      expect(formatReplacingContext(KNOWN_SLOT, DAY_KEY)).toContain(formatReplacingContext(UNKNOWN_SLOT, DAY_KEY))
    })
  })

  describe('a slot code that names a prototype member', () => {
    it('drops the segment for every one of them', () => {
      PROTOTYPE_MEMBER_SLOTS.forEach(slot => {
        expect(formatReplacingContext(slot, DAY_KEY)).toBe(DAY_TEXT)
      })
    })

    it('never renders an inherited function in place of a slot label', () => {
      PROTOTYPE_MEMBER_SLOTS.forEach(slot => {
        const context = formatReplacingContext(slot, DAY_KEY)

        expect(context).not.toContain('function')
        expect(context).not.toContain('native code')
        expect(context).not.toContain('[object')
        expect(context).not.toContain(slot)
      })
    })
  })

  describe('the day key', () => {
    it('labels the day the key itself names rather than a UTC instant of it', () => {
      // parseDayKey builds the date from the key's own parts, which keeps these expectations timezone-independent
      DAY_KEYS.forEach(({key, text}) => {
        expect(formatReplacingContext(KNOWN_SLOT, key)).toBe(replacingText(MEAL_SLOT_SENTENCE_LABELS[KNOWN_SLOT], text))
      })
    })

    it('keeps the day number of every key, including the two that straddle a year', () => {
      DAY_KEYS.forEach(({key}) => {
        const dayOfMonth = String(Number(key.split('-')[2]))

        expect(formatReplacingContext(KNOWN_SLOT, key)).toContain(dayOfMonth)
      })
    })

    it('joins the weekday and the date through the exported template rather than a copy of it', () => {
      expect(formatReplacingContext(KNOWN_SLOT, DAY_KEY)).toBe(
        replacingText(
          MEAL_SLOT_SENTENCE_LABELS[KNOWN_SLOT],
          stringWithNamedParameters(MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE, {weekday: DAY_WEEKDAY, date: DAY_DATE})
        )
      )
    })
  })
})

describe('formatPreviewSubtitle', () => {
  describe('both fragments', () => {
    it('joins the portion and the total time with the shared separator', () => {
      const subtitle = formatPreviewSubtitle(PORTION_TEXT, 25)

      expect(subtitle).toBe(`${PORTION_TEXT}${SWAP_PREVIEW_SUBTITLE_SEPARATOR}${minutesText(25)}`)
    })

    it('reads as the designed sentence', () => {
      expect(formatPreviewSubtitle('1 serving', 25)).toBe('1 serving · 25 min total')
    })

    it('rounds the minutes it renders', () => {
      expect(formatPreviewSubtitle(PORTION_TEXT, 24.6)).toContain(minutesText(25))
    })

    it('trims the portion text it was handed', () => {
      const subtitle = formatPreviewSubtitle(`  ${PORTION_TEXT}  `, 25)

      expect(subtitle).toBe(`${PORTION_TEXT}${SWAP_PREVIEW_SUBTITLE_SEPARATOR}${minutesText(25)}`)
    })
  })

  describe('no usable duration', () => {
    it('drops the time fragment when the recipe reports no minutes', () => {
      expect(formatPreviewSubtitle(PORTION_TEXT, 0)).toBe(PORTION_TEXT)
    })

    it('drops the time fragment for a negative duration', () => {
      expect(formatPreviewSubtitle(PORTION_TEXT, -20)).toBe(PORTION_TEXT)
    })

    it('drops the time fragment for a duration that never arrived as a number', () => {
      expect(formatPreviewSubtitle(PORTION_TEXT, Number.NaN)).toBe(PORTION_TEXT)
      expect(formatPreviewSubtitle(PORTION_TEXT, Number.POSITIVE_INFINITY)).toBe(PORTION_TEXT)
    })
  })

  describe('no usable portion', () => {
    it('drops an empty portion so the time fragment stands alone', () => {
      expect(formatPreviewSubtitle('', 25)).toBe(minutesText(25))
    })

    it('drops a whitespace-only portion', () => {
      expect(formatPreviewSubtitle('   ', 25)).toBe(minutesText(25))
    })
  })

  describe('the separator', () => {
    it('leaves no dangling separator when only the portion survives', () => {
      expect(formatPreviewSubtitle(PORTION_TEXT, 0)).not.toContain(SWAP_PREVIEW_SUBTITLE_SEPARATOR)
    })

    it('leaves no dangling separator when only the duration survives', () => {
      expect(formatPreviewSubtitle('   ', 25)).not.toContain(SWAP_PREVIEW_SUBTITLE_SEPARATOR)
    })

    it('returns an empty subtitle when neither fragment survives', () => {
      expect(formatPreviewSubtitle('   ', 0)).toBe('')
    })
  })
})

describe('resolvePreviewIngredients', () => {
  describe('a recipe that yields more than one serving', () => {
    it('halves the stored amount for one serving of a two-serving recipe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, 2)

      expect(rows).toEqual([{name: 'Chicken breast', quantityText: '5 oz', isOptional: false, key: 'catalog-food-1#0'}])
    })

    it('applies the multiplier and the yield together when both differ from one', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 6, unit: 'cup'})], 1.5, 4)

      expect(rows[0].quantityText).toBe('2¼ cup')
    })

    it('scales a portion larger than one serving upwards', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 4, unit: 'tbsp'})], 2, 2)

      expect(rows[0].quantityText).toBe('4 tbsp')
    })

    it('leaves a single-serving recipe at its stored amount when the portion is one serving', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 3, unit: 'oz'})], 1, 1)

      expect(rows[0].quantityText).toBe('3 oz')
    })
  })

  describe('an ingredient counted rather than measured', () => {
    it('renders the scaled amount alone when the row carries no unit', () => {
      const rows = resolvePreviewIngredients([makeIngredient({name: 'Avocado', quantity: 2, unit: ''})], 1, 2)

      expect(rows[0].quantityText).toBe('1')
    })
  })

  describe('the amount the server pre-formatted', () => {
    it('is never rendered in place of the portion it does not describe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 2, unit: 'cup'})], 1, 2)

      expect(rows[0].quantityText).toBe('1 cup')
      expect(rows[0].quantityText).not.toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('is the only amount left for a quantity that cannot be scaled', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: Number.NaN})], 1, 2)

      expect(rows[0].quantityText).toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('is trimmed when it stands in for an unscalable quantity', () => {
      const padded = `  ${WHOLE_RECIPE_DISPLAY_TEXT}  `
      const rows = resolvePreviewIngredients(
        [makeIngredient({quantity: Number.POSITIVE_INFINITY, displayText: padded})],
        1,
        2
      )

      expect(rows[0].quantityText).toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('leaves the amount empty rather than rendering NaN when neither is usable', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: Number.NaN, displayText: ''})], 1, 2)

      expect(rows[0].quantityText).toBe('')
    })
  })

  describe('a yield or multiplier that cannot divide', () => {
    it('falls back to the stored whole-recipe amount for a zero yield', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, 0)

      expect(rows[0].quantityText).toBe('10 oz')
    })

    it('falls back to the stored whole-recipe amount for a multiplier that never arrived as a number', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], Number.NaN, 2)

      expect(rows[0].quantityText).toBe('10 oz')
    })

    it('renders neither an infinity nor a NaN amount for a negative yield', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, -2)

      expect(rows[0].quantityText).toBe('10 oz')
      expect(rows[0].quantityText).not.toContain('Infinity')
      expect(rows[0].quantityText).not.toContain('NaN')
    })
  })

  describe('the whole list', () => {
    it('keeps the server order and carries each name and optional flag through', () => {
      const rows = resolvePreviewIngredients(
        [
          makeIngredient({name: 'Tortilla, whole wheat', quantity: 2, unit: ''}),
          makeIngredient({name: 'Turkey breast, sliced', quantity: 8, unit: 'oz'}),
          makeIngredient({name: 'Hummus', quantity: 4, unit: 'tbsp', isOptional: true})
        ],
        1,
        2
      )

      expect(rows.map(({name, quantityText, isOptional}) => ({name, quantityText, isOptional}))).toEqual([
        {name: 'Tortilla, whole wheat', quantityText: '1', isOptional: false},
        {name: 'Turkey breast, sliced', quantityText: '4 oz', isOptional: false},
        {name: 'Hummus', quantityText: '2 tbsp', isOptional: true}
      ])
    })

    it('returns an empty list for a recipe with no ingredients rather than throwing', () => {
      expect(resolvePreviewIngredients([], 1, 2)).toEqual([])
    })
  })

  describe('the row keys', () => {
    it('derives each key from the source ingredient rather than from its display name', () => {
      const rows = resolvePreviewIngredients(
        [makeIngredient({catalogFoodId: 'food-a'}), makeIngredient({catalogFoodId: 'food-b'})],
        1,
        2
      )

      expect(rows.map(row => row.key)).toEqual(['food-a#0', 'food-b#1'])
      expect(rows.map(row => row.key)).not.toContain('Chicken breast')
    })

    it('keys two rows that share a display name distinctly', () => {
      const rows = resolvePreviewIngredients(
        [
          makeIngredient({catalogFoodId: 'food-a', name: 'Olive oil', quantity: 2, unit: 'tbsp'}),
          makeIngredient({catalogFoodId: 'food-b', name: 'Olive oil', quantity: 4, unit: 'tbsp'})
        ],
        1,
        2
      )

      expect(rows[0].name).toBe(rows[1].name)
      expect(rows[0].key).not.toBe(rows[1].key)
    })

    it('keys the same food listed twice distinctly, which is why position is part of the key', () => {
      const rows = resolvePreviewIngredients(
        [
          makeIngredient({catalogFoodId: 'food-a', name: 'Olive oil, for the marinade'}),
          makeIngredient({catalogFoodId: 'food-a', name: 'Olive oil, for the sauce'})
        ],
        1,
        2
      )

      expect(rows.map(row => row.key)).toEqual(['food-a#0', 'food-a#1'])
      expect(new Set(rows.map(row => row.key)).size).toBe(rows.length)
    })

    it('keeps every key unique across a list of identical rows', () => {
      const ingredients = [makeIngredient(), makeIngredient(), makeIngredient(), makeIngredient()]
      const rows = resolvePreviewIngredients(ingredients, 1, 2)

      expect(new Set(rows.map(row => row.key)).size).toBe(ingredients.length)
    })

    it('still keys a row whose source carries no catalog id', () => {
      const rows = resolvePreviewIngredients(
        [makeIngredient({catalogFoodId: ''}), makeIngredient({catalogFoodId: ''})],
        1,
        2
      )

      expect(rows.map(row => row.key)).toEqual(['#0', '#1'])
    })

    it('cannot collide two ids that differ only where the position joins them', () => {
      const ingredients = [
        ...Array.from({length: 11}, () => makeIngredient({catalogFoodId: 'food'})),
        makeIngredient({catalogFoodId: 'food1'})
      ]
      const rows = resolvePreviewIngredients(ingredients, 1, 2)

      expect(new Set(rows.map(row => row.key)).size).toBe(ingredients.length)
    })

    it('returns the same key for the same inputs', () => {
      const ingredients = [makeIngredient({catalogFoodId: 'food-a'}), makeIngredient({catalogFoodId: 'food-b'})]

      expect(resolvePreviewIngredients(ingredients, 1, 2).map(row => row.key)).toEqual(
        resolvePreviewIngredients(ingredients, 1, 2).map(row => row.key)
      )
    })
  })

  describe('purity', () => {
    it('does not mutate the ingredients it was given', () => {
      const ingredients = [makeIngredient({quantity: 10, unit: 'oz'})]
      const snapshot = JSON.stringify(ingredients)

      resolvePreviewIngredients(ingredients, 1, 2)

      expect(JSON.stringify(ingredients)).toBe(snapshot)
    })
  })
})
