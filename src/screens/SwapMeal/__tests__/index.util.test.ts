import {MealPlanMeal} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative} from '@data/models/SwapAlternative'
import {
  buildPendingIntent,
  MealPlanStore,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PendingIntentAction,
  resolvePendingIntent
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {matchesFingerprint, requestBody, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {AxiosError, AxiosResponse} from 'axios'

import {stringWithNamedParameters, SWAP_TITLE_TEMPLATE} from '@constants/strings'

import {
  AlternativesAnnouncementInput,
  buildMealMetaText,
  buildNoAlternativesBody,
  buildSwapDateLabel,
  buildSwapRequest,
  buildSwapTitle,
  currentMealEyebrow,
  guardsForNewAttempt,
  isPlanInactive,
  isPlanRevisionStale,
  KeyedMutationState,
  OutcomeMemoryInput,
  rememberedOutcomeForAttempt,
  rendersAlternatives,
  rendersAlternativesGuidance,
  rendersOutcomeRetrySpinner,
  resolveAlternativesAnnouncement,
  resolveAlternativesRevision,
  resolveAlternativesTrust,
  resolveAnnouncementGuard,
  resolveBannerSlot,
  resolveOutcomeMemory,
  resolveReplayableSwap,
  resolveSwapCommitPayload,
  resolveSwapInteraction,
  resolveSwapMountReplay,
  resolveSwapRetryPlan,
  resolveSwapSlotOwnership,
  resolveSwapView,
  resolveUnconfirmedRefetch,
  retiresPendingIntent,
  selectSwapAttemptState,
  SKELETON_ALTERNATIVE_ROWS,
  SkeletonAlternativeRow,
  skeletonBarWidth,
  SwapAttempt,
  SwapAttemptGuards,
  SwapBannerContent,
  SwapInteractionInput,
  SwapMountReplayInput,
  SwapOutcomeMemoryRecord,
  SwapTerminalOutcome,
  SwapView,
  SwapViewInput,
  terminalRecoveryKey,
  UnconfirmedRefetchDecision,
  unconfirmedRefetchKey
} from '../index.util'

// Mocking the persist adapter keeps the suite free of native modules: `index.util` imports the store module for
// its pure replay API, and importing that module creates the persisted store.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

// The text column the bars fill: 321px card interior less the 40px tile and the 12px gap at the 393px
// reference, and the same subtraction on a 375px device
const REFERENCE_TEXT_COLUMN = 269

const NARROW_TEXT_COLUMN = 251

const FIGMA_BAR_WIDTHS = [193.68, 129.12, 156.02, 107.59, 177.54, 139.88]

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

// A confirmed 4xx code is whatever the server put in the body, so a code equal to the name of a member every
// object inherits is a reachable input rather than a hypothetical one: indexing the toast and recovery tables
// with one of these used to resolve that inherited member — a function, or Object.prototype itself — and the
// `?? null` / `?? 'refetchPlan'` fallbacks never fired because an inherited member is not nullish.
const INHERITED_MEMBER_CODES = ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']

const proportionsInRowOrder = () => SKELETON_ALTERNATIVE_ROWS.flatMap(row => [row.primary, row.secondary])

const alternative = (overrides: Partial<SwapAlternative> = {}): SwapAlternative => ({
  recipeVersionId: 'recipe-version-wrap',
  name: 'Turkey and hummus wrap',
  iconKey: 'wrap',
  calories: 540,
  protein: 38,
  totalMinutes: 15,
  portionMultiplier: 1,
  ...overrides
})

const alternatives = (count: number): SwapAlternative[] =>
  Array.from({length: count}, (_, index) => alternative({recipeVersionId: `rv-${index}`}))

const plannedMeal = (slot: MealSlot = 'lunch'): MealPlanMeal => ({
  id: 'meal-1',
  revision: 3,
  slot,
  slotTime: '12:30',
  sortOrder: 1,
  recipe: {
    versionId: 'recipe-version-bowl',
    recipeId: 'recipe-bowl',
    name: 'Chicken burrito bowl',
    iconKey: 'bowl',
    totalMinutes: 25,
    badges: ['high_protein'],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: {calories: 610, protein: 45, carbs: 58, fat: 21},
  flags: [],
  previousRecipe: null,
  loggedEntries: []
})

const swapInput = (overrides: Partial<SwapViewInput> = {}): SwapViewInput => ({
  currentMeal: plannedMeal(),
  alternatives: [alternative()],
  isAlternativesPending: false,
  isAlternativesFetching: false,
  isAlternativesTrusted: true,
  alternativesError: null,
  swapError: null,
  rememberedOutcome: null,
  isAttemptPending: false,
  isDayPending: false,
  dayError: null,
  ...overrides
})

const axiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

const apiError = (status?: number, code?: string): AxiosError =>
  axiosError(status, code === undefined ? {} : {error: code})

const transportError = (): AxiosError => axiosError()

const undecodableError = (): AxiosError => axiosError(502, '<html>gateway</html>')

const bannerOf = (view: SwapView): SwapBannerContent | null => ('banner' in view ? view.banner : null)

// The cast is the only way to reach the write the readonly row properties forbid at compile time. Writing to a
// frozen object throws in strict mode and fails silently outside it, and which mode the transpiled test module
// runs in is not what this asserts, so either outcome is accepted here and the surviving value is asserted by
// the caller.
const attemptRowWrite = (row: SkeletonAlternativeRow): void => {
  const writable = row as {primary: number; secondary: number}

  try {
    writable.primary = 0.99
    writable.secondary = 0.99
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError)
  }
}

describe('resolveSwapView', () => {
  describe('while the screen is still assembling (13c)', () => {
    it('loads while the alternatives request is in flight', () => {
      expect(resolveSwapView(swapInput({isAlternativesPending: true, alternatives: undefined}))).toEqual({
        kind: 'loading',
        currentMealVariant: 'default'
      })
    })

    it('loads while the day request is in flight and has not produced the meal being replaced', () => {
      expect(resolveSwapView(swapInput({currentMeal: null, isDayPending: true}))).toEqual({
        kind: 'loading',
        currentMealVariant: 'default'
      })
    })

    it('loads rather than claiming an empty slot when nothing has been decoded yet', () => {
      const view = resolveSwapView(swapInput({alternatives: undefined}))

      expect(view.kind).toBe('loading')
    })
  })

  describe('with a day request that did not produce the meal', () => {
    it('is the retry card rather than an endless skeleton when the day request failed', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, isDayPending: false, dayError: transportError()}))

      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('day')
    })

    it('offers one retry and states only that the screen could not be loaded', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, dayError: transportError()}))

      expect(bannerOf(view)).toEqual({
        tone: 'error',
        glyph: 'alert',
        body: "Couldn't load this right now.",
        actionLabel: 'Try again'
      })
    })

    it('retries the day rather than the alternatives while the request is still in flight', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, isDayPending: true, dayError: transportError()}))

      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('day')
    })

    it('never loads once the day request has settled with neither the meal nor an error', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, isDayPending: false, dayError: null}))

      expect(view.kind).not.toBe('loading')
      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('day')
    })

    it('withholds the alternatives list until the meal being replaced is known', () => {
      expect(rendersAlternatives(resolveSwapView(swapInput({currentMeal: null, dayError: transportError()})))).toBe(
        false
      )
    })
  })

  describe('with a day request that failed behind a decoded meal', () => {
    it('keeps the list on screen when a background refetch merely failed', () => {
      const view = resolveSwapView(swapInput({dayError: transportError()}))

      expect(view).toEqual({kind: 'list', currentMealVariant: 'default', alternatives: [alternative()]})
    })

    it('keeps the decoded empty state when a background refetch merely failed', () => {
      expect(resolveSwapView(swapInput({alternatives: [], dayError: transportError()})).kind).toBe('empty')
    })

    it('is terminal once the day answer says the plan moved on, and says the answer came from the day', () => {
      const view = resolveSwapView(swapInput({dayError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'stale_plan',
        source: 'day',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
    })

    it('is terminal on a superseded plan even while the day request is in flight', () => {
      const view = resolveSwapView(
        swapInput({currentMeal: null, isDayPending: true, dayError: apiError(409, API_ERROR_CODES.planNotActive)})
      )

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal.recovery : null).toBe('refetchPlan')
      expect(view.kind === 'terminal' ? view.terminal.source : null).toBe('day')
    })
  })

  describe('with alternatives to choose from (13)', () => {
    it('lists the decoded alternatives behind the default current-meal card', () => {
      expect(resolveSwapView(swapInput())).toEqual({
        kind: 'list',
        currentMealVariant: 'default',
        alternatives: [alternative()]
      })
    })

    it('carries every alternative in the order the response gave them', () => {
      const first = alternative({recipeVersionId: 'a', name: 'Chipotle chicken salad'})
      const second = alternative({recipeVersionId: 'b', name: 'Beef and rice bowl'})
      const view = resolveSwapView(swapInput({alternatives: [first, second]}))

      expect(rendersAlternatives(view) ? view.alternatives : []).toEqual([first, second])
    })

    it('lists one, four, and the eight the server answers with, each at its own length', () => {
      const counts = [1, 4, 8]

      counts.forEach(count => {
        const view = resolveSwapView(swapInput({alternatives: alternatives(count)}))

        expect(view.kind).toBe('list')
        expect(rendersAlternatives(view) ? view.alternatives : []).toHaveLength(count)
      })
    })

    it("applies no cap of its own, because the eight-row cap is the server's", () => {
      const rows = alternatives(9)
      const view = resolveSwapView(swapInput({alternatives: rows}))

      expect(rendersAlternatives(view) ? view.alternatives : []).toHaveLength(9)
      expect(rendersAlternatives(view) ? view.alternatives.map(row => row.recipeVersionId) : []).toEqual(
        rows.map(row => row.recipeVersionId)
      )
    })
  })

  describe('with a decoded empty response (13d)', () => {
    it('is the no-alternatives state and marks the current meal unchanged', () => {
      expect(resolveSwapView(swapInput({alternatives: []}))).toEqual({
        kind: 'empty',
        currentMealVariant: 'unchanged'
      })
    })

    it('renders no alternatives list and no banner', () => {
      const view = resolveSwapView(swapInput({alternatives: []}))

      expect(rendersAlternatives(view)).toBe(false)
      expect(bannerOf(view)).toBeNull()
    })
  })

  describe('with a failed alternatives request', () => {
    it('is the inline retry state, never the drawn empty state', () => {
      const view = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))

      expect(view.kind).toBe('error')
      expect(view.currentMealVariant).toBe('default')
    })

    it('offers one retry and states only that alternatives could not be found', () => {
      const view = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))

      expect(bannerOf(view)).toEqual({
        tone: 'error',
        glyph: 'alert',
        body: "Couldn't find alternatives right now.",
        actionLabel: 'Try again'
      })
    })

    it('is the retry state even when the failure carried a decodable code', () => {
      const view = resolveSwapView(
        swapInput({alternativesError: apiError(500, 'something_unrecognised'), alternatives: undefined})
      )

      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('alternatives')
    })

    it('keeps a request that decoded nothing distinct from a decoded empty list', () => {
      const nothingDecoded = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))
      const emptyResponse = resolveSwapView(swapInput({alternatives: []}))

      expect(nothingDecoded.kind).toBe('error')
      expect(emptyResponse.kind).toBe('empty')
    })

    it('never carries the drawn empty state variant, and the empty state never carries this one', () => {
      const failedRequest = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))
      const emptyResponse = resolveSwapView(swapInput({alternatives: []}))

      expect(failedRequest.currentMealVariant).toBe('default')
      expect(emptyResponse.currentMealVariant).toBe('unchanged')
      expect(failedRequest.currentMealVariant).not.toBe(emptyResponse.currentMealVariant)
    })
  })

  describe('with an alternatives request that failed behind decoded alternatives', () => {
    it('keeps the list on screen when a background refetch merely failed', () => {
      const view = resolveSwapView(swapInput({alternativesError: transportError()}))

      expect(view).toEqual({kind: 'list', currentMealVariant: 'default', alternatives: [alternative()]})
    })

    it('keeps the decoded empty state when a background refetch merely failed', () => {
      const view = resolveSwapView(swapInput({alternatives: [], alternativesError: transportError()}))

      expect(view.kind).toBe('empty')
      expect(view.currentMealVariant).toBe('unchanged')
    })

    it('draws the retry card only once nothing has been decoded', () => {
      expect(resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined})).kind).toBe(
        'error'
      )
    })

    it('keeps both decoded states through an undecodable body, not only through a lost connection', () => {
      const listView = resolveSwapView(swapInput({alternativesError: undecodableError()}))
      const emptyView = resolveSwapView(swapInput({alternatives: [], alternativesError: undecodableError()}))
      const nothingDecoded = resolveSwapView(
        swapInput({alternativesError: undecodableError(), alternatives: undefined})
      )

      expect(rendersAlternatives(listView) ? listView.alternatives : null).toEqual([alternative()])
      expect(emptyView.kind).toBe('empty')
      expect(nothingDecoded.kind).toBe('error')
    })
  })

  describe('with an authoritative alternatives refusal', () => {
    it('is terminal once the alternatives answer says the plan moved on, and names the read that answered', () => {
      const view = resolveSwapView(swapInput({alternativesError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'stale_plan',
        source: 'alternatives',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
    })

    it('re-reads the plan when the alternatives answer says it is no longer active', () => {
      const view = resolveSwapView(swapInput({alternativesError: apiError(409, API_ERROR_CODES.planNotActive)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'plan_not_active',
        source: 'alternatives',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
    })

    it('leaves for the plan tab without a toast when the capability itself is off', () => {
      const view = resolveSwapView(swapInput({alternativesError: apiError(503, API_ERROR_CODES.featureDisabled)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'feature_disabled',
        source: 'alternatives',
        toastText: null,
        recovery: 'exitToPlanTab'
      })
    })

    // The refusal is about the plan these rows belong to, so reading them is the unsafe act: it outranks the
    // cache the way a terminal day answer already does, and it may not wait behind a refetch either.
    it('outranks a decoded list, a decoded empty array and a request still in flight', () => {
      const refusals = [
        apiError(409, API_ERROR_CODES.stalePlan),
        apiError(409, API_ERROR_CODES.planNotActive),
        apiError(503, API_ERROR_CODES.featureDisabled)
      ]

      refusals.forEach(alternativesError => {
        expect(resolveSwapView(swapInput({alternativesError})).kind).toBe('terminal')
        expect(resolveSwapView(swapInput({alternativesError, alternatives: []})).kind).toBe('terminal')
        expect(
          resolveSwapView(swapInput({alternativesError, isAlternativesPending: true, alternatives: undefined})).kind
        ).toBe('terminal')
      })
    })

    it('never retires the pending key, because the alternatives query is a read', () => {
      const refusals = [
        apiError(409, API_ERROR_CODES.stalePlan),
        apiError(409, API_ERROR_CODES.planNotActive),
        apiError(503, API_ERROR_CODES.featureDisabled)
      ]

      refusals.forEach(alternativesError =>
        expect(retiresPendingIntent(resolveSwapView(swapInput({alternativesError})))).toBe(false)
      )
    })

    it('leaves a confirmed refusal with no authoritative next move as the retry card', () => {
      const view = resolveSwapView(
        swapInput({alternativesError: apiError(400, API_ERROR_CODES.invalidRequest), alternatives: undefined})
      )

      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('alternatives')
    })

    it('leaves a 5xx that merely echoed a plan-state code as the retry card, an outcome nothing described', () => {
      const staleEcho = resolveSwapView(
        swapInput({alternativesError: apiError(502, API_ERROR_CODES.stalePlan), alternatives: undefined})
      )
      const inactiveEcho = resolveSwapView(
        swapInput({alternativesError: apiError(500, API_ERROR_CODES.planNotActive), alternatives: undefined})
      )

      expect(staleEcho.kind).toBe('error')
      expect(inactiveEcho.kind).toBe('error')
    })

    // The rows were computed for the revision the refusal has just contradicted, so they are candidates the
    // server would refuse: the recovery re-reads the list, and the trust clock keeps the screen off the
    // contradicted array until that answer lands.
    it('withholds the list it was holding, because those rows belong to the contradicted revision', () => {
      const view = resolveSwapView(swapInput({alternativesError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(rendersAlternatives(view)).toBe(false)
      expect(rendersAlternativesGuidance(view)).toBe(false)
    })
  })

  // The capability answer has one recovery whichever request carried it: the tab's entitlement router draws the
  // unavailable card from this very signal, and no next move on a swap screen survives the feature being off.
  describe('with the capability reported off', () => {
    it('leaves for the plan tab on the commit, and that answer does retire the key', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(503, API_ERROR_CODES.featureDisabled)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'feature_disabled',
        source: 'swap',
        toastText: null,
        recovery: 'exitToPlanTab'
      })
      expect(retiresPendingIntent(view)).toBe(true)
    })

    it('leaves for the plan tab on the day read, without retiring the key', () => {
      const view = resolveSwapView(swapInput({dayError: apiError(503, API_ERROR_CODES.featureDisabled)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'feature_disabled',
        source: 'day',
        toastText: null,
        recovery: 'exitToPlanTab'
      })
      expect(retiresPendingIntent(view)).toBe(false)
    })

    it('never asks for a plan refetch behind a route that answers 503', () => {
      const sources = [
        swapInput({swapError: apiError(503, API_ERROR_CODES.featureDisabled)}),
        swapInput({dayError: apiError(503, API_ERROR_CODES.featureDisabled)}),
        swapInput({alternativesError: apiError(503, API_ERROR_CODES.featureDisabled)})
      ]

      sources.forEach(input => {
        const view = resolveSwapView(input)

        expect(view.kind === 'terminal' ? view.terminal.recovery : null).toBe('exitToPlanTab')
      })
    })
  })

  describe('with a confirmed swap failure (13e)', () => {
    it('names the meal it left alone and outlines the current-meal card', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}))

      expect(view.kind).toBe('failed')
      expect(view.currentMealVariant).toBe('stillYours')
      expect(bannerOf(view)).toEqual({
        tone: 'error',
        glyph: 'alert',
        title: "We couldn't swap that meal",
        body: 'Your lunch is unchanged and your grocery list was not updated.',
        actionLabel: 'Try again',
        secondaryActionLabel: 'Back to alternatives'
      })
    })

    it('names the slot of the meal that failed', () => {
      const view = resolveSwapView(
        swapInput({currentMeal: plannedMeal('dinner'), swapError: apiError(502, API_ERROR_CODES.swapFailed)})
      )

      expect(bannerOf(view)?.body).toBe('Your dinner is unchanged and your grocery list was not updated.')
    })

    it('keeps the alternatives list on screen', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}))

      expect(rendersAlternatives(view)).toBe(true)
      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([alternative()])
    })

    it('renders an empty list when the alternatives were never decoded', () => {
      const view = resolveSwapView(
        swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed), alternatives: undefined})
      )

      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
    })

    it('promises nothing about the plan when the meal is not known', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, swapError: apiError(502, API_ERROR_CODES.swapFailed)}))
      const banner = bannerOf(view)

      expect(view.kind).toBe('failed')
      expect(banner?.title).toBeUndefined()
      expect(banner?.body).toBe("We couldn't swap that meal")
      expect(banner?.body).not.toContain('unchanged')
    })
  })

  describe('with an unconfirmed swap outcome', () => {
    it('takes the neutral variant when the response was lost', () => {
      const view = resolveSwapView(swapInput({swapError: transportError()}))

      expect(view.kind).toBe('unconfirmed')
      expect(view.currentMealVariant).toBe('default')
    })

    it('treats an undecodable body as unconfirmed', () => {
      expect(resolveSwapView(swapInput({swapError: undecodableError()})).kind).toBe('unconfirmed')
    })

    it('treats a 5xx without a recognised code as unconfirmed', () => {
      expect(resolveSwapView(swapInput({swapError: apiError(504, 'Bad gateway')})).kind).toBe('unconfirmed')
    })

    it('treats a 5xx that carried no code at all as unconfirmed', () => {
      expect(resolveSwapView(swapInput({swapError: apiError(502)})).kind).toBe('unconfirmed')
    })

    it('never reuses the confirmed failure banner, the one copy allowed to promise nothing changed', () => {
      const unconfirmed = bannerOf(resolveSwapView(swapInput({swapError: transportError()})))
      const confirmed = bannerOf(resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)})))

      expect(unconfirmed).not.toEqual(confirmed)
      expect(unconfirmed?.title).not.toBe(confirmed?.title)
      expect(unconfirmed?.body).not.toBe(confirmed?.body)
      expect(confirmed?.body).toContain('unchanged')
      expect(unconfirmed?.body).not.toContain('unchanged')
    })

    it('asks the user to retry without claiming the meal is unchanged', () => {
      const view = resolveSwapView(swapInput({swapError: transportError()}))

      expect(bannerOf(view)).toEqual({
        tone: 'error',
        glyph: 'alert',
        title: "We couldn't confirm that",
        body: 'Check your connection and try again.',
        actionLabel: 'Try again',
        secondaryActionLabel: 'Back to alternatives'
      })
      expect(bannerOf(view)?.body).not.toContain('unchanged')
    })

    it('withholds the alternatives list until the outcome resolves', () => {
      expect(rendersAlternatives(resolveSwapView(swapInput({swapError: transportError()})))).toBe(false)
    })

    // The plan refetch this state triggers is display-only: it can show a commit that landed, but only an answer
    // to the same key may resolve the attempt, so a stale-plan answer from the day query must not retire the
    // intent or replace the copy that promises nothing about what changed.
    it('outranks a terminal day answer, so no plan refetch resolves the pending key', () => {
      const view = resolveSwapView(
        swapInput({swapError: transportError(), dayError: apiError(409, API_ERROR_CODES.stalePlan)})
      )

      expect(view.kind).toBe('unconfirmed')
      expect(retiresPendingIntent(view)).toBe(false)
      expect(bannerOf(view)?.title).toBe("We couldn't confirm that")
    })
  })

  // A same-key replay is in flight: TanStack has already reset the entry to pending with no error, so the
  // outcome being retried survives only as the remembered one, and it is what the screen must keep drawing.
  describe('with a same-key retry in flight', () => {
    const retryingFailure = (overrides: Partial<SwapViewInput> = {}): SwapView =>
      resolveSwapView(swapInput({swapError: null, rememberedOutcome: 'failed', isAttemptPending: true, ...overrides}))

    const retryingUnknown = (overrides: Partial<SwapViewInput> = {}): SwapView =>
      resolveSwapView(
        swapInput({swapError: null, rememberedOutcome: 'unconfirmed', isAttemptPending: true, ...overrides})
      )

    it('keeps the confirmed failure on screen, banner and outlined card included', () => {
      const view = retryingFailure()

      expect(view.kind).toBe('retrying')
      expect(view.currentMealVariant).toBe('stillYours')
      expect(bannerOf(view)).toEqual(bannerOf(resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed')}))))
    })

    it('keeps the unknown outcome neutral, so no assurance is drawn for a commit that may have landed', () => {
      const view = retryingUnknown()

      expect(view.kind).toBe('retrying')
      expect(view.currentMealVariant).toBe('default')
      expect(bannerOf(view)).toEqual(bannerOf(resolveSwapView(swapInput({swapError: transportError()}))))
      expect(bannerOf(view)?.body).not.toContain('unchanged')
    })

    it('names the slot being retried, and promises nothing when the meal is not known', () => {
      expect(bannerOf(retryingFailure({currentMeal: plannedMeal('dinner')}))?.body).toBe(
        'Your dinner is unchanged and your grocery list was not updated.'
      )

      const unknownMeal = bannerOf(retryingFailure({currentMeal: null}))

      expect(unknownMeal?.title).toBeUndefined()
      expect(unknownMeal?.body).not.toContain('unchanged')
    })

    // The rows are the danger: opening one commits a second swap under a key the first commit may already have
    // spent, so the replay carries no list at all rather than a disabled one.
    it('carries no alternatives and no guidance, however many were decoded', () => {
      const views = [retryingFailure(), retryingUnknown(), retryingFailure({alternatives: alternatives(8)})]

      views.forEach(view => {
        expect(rendersAlternatives(view)).toBe(false)
        expect(rendersAlternativesGuidance(view)).toBe(false)
      })
    })

    // Only an answer to the key can settle whether the commit landed, so a read's refusal may not interrupt it.
    it('outranks every read: a terminal day answer, an alternatives refusal and a failed day request', () => {
      const refusals: Partial<SwapViewInput>[] = [
        {dayError: apiError(409, API_ERROR_CODES.stalePlan)},
        {dayError: apiError(503, API_ERROR_CODES.featureDisabled)},
        {alternativesError: apiError(409, API_ERROR_CODES.planNotActive)},
        {currentMeal: null, dayError: transportError()},
        {isAlternativesPending: true, alternatives: undefined},
        {alternatives: []}
      ]

      refusals.forEach(overrides => {
        expect(retryingFailure(overrides).kind).toBe('retrying')
        expect(retryingUnknown(overrides).kind).toBe('retrying')
      })
    })

    it('never retires the pending intent, because no answer to the key has arrived yet', () => {
      expect(retiresPendingIntent(retryingFailure())).toBe(false)
      expect(retiresPendingIntent(retryingUnknown())).toBe(false)
    })

    it('draws the rows again once the retry settles into an outcome of its own', () => {
      const settled = resolveSwapView(
        swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed), rememberedOutcome: 'failed'})
      )

      expect(settled.kind).toBe('failed')
      expect(rendersAlternatives(settled) ? settled.alternatives : null).toEqual([alternative()])
    })

    // A silent cold-start replay has no earlier outcome to redraw, and 13/13c/13d are what it must not disturb.
    it('is never entered by a pending attempt with no remembered outcome', () => {
      expect(resolveSwapView(swapInput({isAttemptPending: true})).kind).toBe('list')
      expect(resolveSwapView(swapInput({isAttemptPending: true, alternatives: []})).kind).toBe('empty')
      expect(
        resolveSwapView(swapInput({isAttemptPending: true, isAlternativesPending: true, alternatives: undefined})).kind
      ).toBe('loading')
    })

    it('is never entered by a remembered outcome once nothing is in flight', () => {
      expect(resolveSwapView(swapInput({rememberedOutcome: 'failed'})).kind).toBe('list')
      expect(resolveSwapView(swapInput({rememberedOutcome: 'unconfirmed', swapError: transportError()})).kind).toBe(
        'unconfirmed'
      )
    })
  })

  describe('with a terminal swap refusal', () => {
    it('names a stale plan as terminal and withholds the alternatives it was holding', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'stale_plan',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
      expect(rendersAlternatives(view)).toBe(false)
    })

    it('sends the user back to refetch the plan when it is no longer active', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.planNotActive)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'plan_not_active',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
    })

    it('sends the user back to the list when the preview it was built from went stale', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.previewStale)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'preview_stale',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'reselectAlternative'
      })
    })

    it('names an ineligible recipe as terminal and asks for another alternative', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(422, API_ERROR_CODES.recipeIneligible)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'recipe_ineligible',
        source: 'swap',
        toastText: 'That meal no longer fits your plan.',
        recovery: 'reselectAlternative'
      })
    })

    it('asks for another alternative when the key was reused with a changed request', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.idempotencyConflict)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'idempotency_conflict',
        source: 'swap',
        toastText: null,
        recovery: 'reselectAlternative'
      })
    })

    it('carries a confirmed code this release has no copy for without inventing any', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(400, API_ERROR_CODES.invalidRequest)}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'invalid_request',
        source: 'swap',
        toastText: null,
        recovery: 'refetchPlan'
      })
    })

    it('carries no rows whether or not any were decoded, so no candidate can be opened', () => {
      const decoded = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}))
      const neverDecoded = resolveSwapView(
        swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan), alternatives: undefined})
      )

      expect(rendersAlternatives(decoded)).toBe(false)
      expect(rendersAlternatives(neverDecoded)).toBe(false)
      expect(Object.keys(decoded)).toEqual(Object.keys(neverDecoded))
    })

    it('takes the default current-meal card, never the drawn 13e assurance', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(view.currentMealVariant).toBe('default')
      expect(bannerOf(view)).toBeNull()
    })

    it('outranks an alternatives request that is still in flight', () => {
      const view = resolveSwapView(
        swapInput({
          swapError: apiError(409, API_ERROR_CODES.stalePlan),
          isAlternativesPending: true,
          alternatives: undefined
        })
      )

      expect(view.kind).toBe('terminal')
    })

    it('never reads a confirmed 4xx as an unconfirmed outcome', () => {
      const confirmed = [
        apiError(409, API_ERROR_CODES.stalePlan),
        apiError(409, API_ERROR_CODES.planNotActive),
        apiError(409, API_ERROR_CODES.previewStale),
        apiError(422, API_ERROR_CODES.recipeIneligible),
        apiError(409, API_ERROR_CODES.idempotencyConflict)
      ]

      confirmed.forEach(swapError => expect(resolveSwapView(swapInput({swapError})).kind).toBe('terminal'))
      confirmed.forEach(swapError => expect(resolveSwapView(swapInput({swapError})).kind).not.toBe('unconfirmed'))
    })

    it('never reads an absent error as a refusal', () => {
      expect(resolveSwapView(swapInput({swapError: null})).kind).toBe('list')
      expect(resolveSwapView(swapInput({swapError: undefined})).kind).toBe('list')
    })
  })

  describe('with a refusal code that names a member every object inherits', () => {
    it.each(INHERITED_MEMBER_CODES)('carries %s as a code with no copy and the plan refetch', code => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, code)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code,
        source: 'swap',
        toastText: null,
        recovery: 'refetchPlan'
      })
    })

    it.each(INHERITED_MEMBER_CODES)('answers %s from the day query the same way', code => {
      const view = resolveSwapView(swapInput({dayError: apiError(409, code)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code,
        source: 'day',
        toastText: null,
        recovery: 'refetchPlan'
      })
    })

    it('hands the toast no inherited function and the recovery switch no inherited value', () => {
      const inheritedFunctionCode = 'constructor'
      const swapTerminal = resolveSwapView(swapInput({swapError: apiError(409, inheritedFunctionCode)}))
      const dayTerminal = resolveSwapView(swapInput({dayError: apiError(409, inheritedFunctionCode)}))
      const terminals = [swapTerminal, dayTerminal].map(view => (view.kind === 'terminal' ? view.terminal : null))

      terminals.forEach(terminal => {
        expect(terminal?.toastText).toBeNull()
        expect(typeof terminal?.recovery).toBe('string')
        expect(terminal?.recovery).toBe('refetchPlan')
      })
    })

    it('still withholds the alternatives, as every other terminal refusal does', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'toString')}))

      expect(rendersAlternatives(view)).toBe(false)
      expect(retiresPendingIntent(view)).toBe(true)
    })
  })

  // The commit is the action the user just asked for, so whatever the alternatives request is doing, its outcome
  // is the one the screen has to answer for.
  describe('with a commit outcome beside an unsettled alternatives request', () => {
    it('classifies the commit before the alternatives request that is still in flight', () => {
      const view = resolveSwapView(
        swapInput({
          swapError: apiError(502, API_ERROR_CODES.swapFailed),
          isAlternativesPending: true,
          alternatives: undefined
        })
      )

      expect(view.kind).toBe('failed')
    })

    it('classifies a confirmed failure before an alternatives request that failed', () => {
      const view = resolveSwapView(
        swapInput({
          swapError: apiError(502, API_ERROR_CODES.swapFailed),
          alternativesError: transportError(),
          alternatives: undefined
        })
      )

      expect(view.kind).toBe('failed')
    })

    it('classifies an unconfirmed outcome before an alternatives request that is still in flight', () => {
      const view = resolveSwapView(
        swapInput({swapError: transportError(), isAlternativesPending: true, alternatives: undefined})
      )

      expect(view.kind).toBe('unconfirmed')
    })

    it('classifies an unconfirmed outcome before an alternatives request that failed', () => {
      const view = resolveSwapView(
        swapInput({swapError: transportError(), alternativesError: transportError(), alternatives: undefined})
      )

      expect(view.kind).toBe('unconfirmed')
    })
  })

  // The window after a refusal has been recovered from: the error is gone, but TanStack still serves the array
  // it contradicted, so the rows may not come back until the list has answered again.
  describe('with a list a refusal has contradicted', () => {
    const untrusted = (overrides: Partial<SwapViewInput> = {}): SwapView =>
      resolveSwapView(swapInput({isAlternativesTrusted: false, ...overrides}))

    it('is 13c while the re-read is in flight, never the rows the cache still holds', () => {
      const view = untrusted({isAlternativesFetching: true})

      expect(view).toEqual({kind: 'loading', currentMealVariant: 'default'})
      expect(rendersAlternatives(view)).toBe(false)
    })

    it('is 13c before the re-read has even started, so no render can slip the rows back', () => {
      expect(untrusted().kind).toBe('loading')
    })

    it('is the alternatives retry card once the re-read has settled with an error', () => {
      const view = untrusted({alternativesError: transportError()})

      expect(view.kind).toBe('error')
      expect(view.kind === 'error' ? view.retry : null).toBe('alternatives')
      expect(bannerOf(view)?.body).toBe("Couldn't find alternatives right now.")
    })

    it('is 13c again while that retry is in flight', () => {
      expect(untrusted({alternativesError: transportError(), isAlternativesFetching: true}).kind).toBe('loading')
    })

    // 13d states that nothing matches the slot. A decoded empty array from the contradicted revision says
    // nothing about the revision the plan now carries.
    it('is never the 13d empty state, however the empty array was decoded', () => {
      expect(untrusted({alternatives: []}).kind).toBe('loading')
      expect(untrusted({alternatives: [], isAlternativesFetching: true}).kind).toBe('loading')
      expect(untrusted({alternatives: [], alternativesError: transportError()}).kind).toBe('error')
    })

    it('still resolves a dead plan to its terminal view rather than to a spinner', () => {
      const refusals = [
        swapInput({isAlternativesTrusted: false, swapError: apiError(409, API_ERROR_CODES.stalePlan)}),
        swapInput({isAlternativesTrusted: false, dayError: apiError(409, API_ERROR_CODES.planNotActive)}),
        swapInput({isAlternativesTrusted: false, alternativesError: apiError(503, API_ERROR_CODES.featureDisabled)})
      ]

      refusals.forEach(input => expect(resolveSwapView(input).kind).toBe('terminal'))
    })

    // The day's own failure keeps its own retry: retrying the alternatives would leave the header and the
    // current-meal card empty forever.
    it('still answers the day first when the meal being replaced is unknown', () => {
      const failedDay = untrusted({currentMeal: null, dayError: transportError()})

      expect(untrusted({currentMeal: null, isDayPending: true}).kind).toBe('loading')
      expect(failedDay.kind).toBe('error')
      expect(failedDay.kind === 'error' ? failedDay.retry : null).toBe('day')
    })

    it('still keeps a same-key replay on screen, which outranks every read', () => {
      expect(untrusted({rememberedOutcome: 'unconfirmed', isAttemptPending: true}).kind).toBe('retrying')
    })

    it('draws the rows again the moment the list answers, with no other input changing', () => {
      const answered = resolveSwapView(swapInput({isAlternativesTrusted: true}))

      expect(answered).toEqual({kind: 'list', currentMealVariant: 'default', alternatives: [alternative()]})
    })
  })

  describe('as a pure derivation', () => {
    it('leaves the alternatives it was given in the order it was given them', () => {
      const rows = [alternative({recipeVersionId: 'rv-a'}), alternative({recipeVersionId: 'rv-b'})]
      const before = [...rows]

      resolveSwapView(swapInput({alternatives: rows}))

      expect(rows).toEqual(before)
      expect(rows).toHaveLength(2)
      expect(rows.map(row => row.recipeVersionId)).toEqual(['rv-a', 'rv-b'])
    })

    it('returns the same view for the same input', () => {
      const input = swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)})

      expect(resolveSwapView(input)).toEqual(resolveSwapView(input))
    })

    it('returns the same view for the same input in every state it can reach', () => {
      const inputs = [
        swapInput(),
        swapInput({alternatives: []}),
        swapInput({isAlternativesPending: true, alternatives: undefined}),
        swapInput({alternativesError: transportError(), alternatives: undefined}),
        swapInput({alternativesError: transportError()}),
        swapInput({alternativesError: undecodableError(), alternatives: []}),
        swapInput({alternativesError: apiError(409, API_ERROR_CODES.stalePlan)}),
        swapInput({alternativesError: apiError(503, API_ERROR_CODES.featureDisabled)}),
        swapInput({currentMeal: null, dayError: transportError()}),
        swapInput({dayError: apiError(503, API_ERROR_CODES.featureDisabled)}),
        swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}),
        swapInput({swapError: apiError(503, API_ERROR_CODES.featureDisabled)}),
        swapInput({swapError: transportError()}),
        swapInput({rememberedOutcome: 'failed', isAttemptPending: true}),
        swapInput({rememberedOutcome: 'unconfirmed', isAttemptPending: true})
      ]

      inputs.forEach(input => expect(resolveSwapView(input)).toEqual(resolveSwapView(input)))
    })
  })
})

describe('rendersAlternatives', () => {
  it('renders the list for the alternatives state and for a confirmed failure', () => {
    expect(rendersAlternatives(resolveSwapView(swapInput()))).toBe(true)
    expect(
      rendersAlternatives(resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)})))
    ).toBe(true)
  })

  it('renders an empty 13e list rather than nothing when the alternatives were never decoded', () => {
    const view = resolveSwapView(
      swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed), alternatives: undefined})
    )

    expect(rendersAlternatives(view)).toBe(true)
    expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
  })

  // The 13e failure is the one refusal that leaves the plan provably untouched, so its rows are still the
  // user's next move. Every other refusal contradicts the revision the rows were computed for.
  it('renders no list for a terminal refusal, whichever request answered it', () => {
    const sources = [
      swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}),
      swapInput({dayError: apiError(409, API_ERROR_CODES.planNotActive)}),
      swapInput({alternativesError: apiError(409, API_ERROR_CODES.planNotActive)}),
      swapInput({alternativesError: apiError(503, API_ERROR_CODES.featureDisabled), alternatives: undefined})
    ]

    sources.forEach(input => {
      const view = resolveSwapView(input)

      expect(view.kind).toBe('terminal')
      expect(rendersAlternatives(view)).toBe(false)
    })
  })

  it('renders no list while loading, when empty, on a failed request, an unconfirmed outcome or a replay', () => {
    const withoutList = [
      resolveSwapView(swapInput({isAlternativesPending: true, alternatives: undefined})),
      resolveSwapView(swapInput({alternatives: []})),
      resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined})),
      resolveSwapView(swapInput({swapError: transportError()})),
      resolveSwapView(swapInput({rememberedOutcome: 'failed', isAttemptPending: true}))
    ]

    withoutList.forEach(view => expect(rendersAlternatives(view)).toBe(false))
  })
})

describe('rendersAlternativesGuidance', () => {
  it('carries the hint and the footnote on the alternatives state', () => {
    expect(rendersAlternativesGuidance(resolveSwapView(swapInput()))).toBe(true)
  })

  // 13's footnote promises that opening an alternative replaces nothing. A refusal draws no alternatives to
  // promise anything about, and the hint would caption a list the plan has moved past.
  it('drops both on a terminal refusal, which draws no list to caption', () => {
    const sources = [
      swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}),
      swapInput({dayError: apiError(409, API_ERROR_CODES.stalePlan)}),
      swapInput({alternativesError: apiError(409, API_ERROR_CODES.stalePlan)})
    ]

    sources.forEach(input => expect(rendersAlternativesGuidance(resolveSwapView(input))).toBe(false))
  })

  it('drops both on a confirmed failure, which draws the list without either', () => {
    // Frame 13e's overline block is a single-child column and its card is the last thing on the screen: after a
    // confirmed failure the plan is known unchanged and the banner has already said so, so neither the
    // "fits your targets" hint nor the footnote's promise is drawn.
    const failed = resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}))

    expect(rendersAlternatives(failed)).toBe(true)
    expect(rendersAlternativesGuidance(failed)).toBe(false)
  })

  it('drops both on every state that draws no list at all', () => {
    const withoutList = [
      resolveSwapView(swapInput({isAlternativesPending: true, alternatives: undefined})),
      resolveSwapView(swapInput({alternatives: []})),
      resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined})),
      resolveSwapView(swapInput({swapError: transportError()})),
      resolveSwapView(swapInput({rememberedOutcome: 'unconfirmed', isAttemptPending: true}))
    ]

    withoutList.forEach(view => expect(rendersAlternativesGuidance(view)).toBe(false))
  })
})

describe('rendersOutcomeRetrySpinner', () => {
  // The retry-pending view redraws the outcome it is reconciling unchanged, so the spinner is the only thing
  // that distinguishes a same-key replay in flight from the settled failure the user just pressed retry on —
  // and the reason every alternative is withheld while it runs.
  it('draws the indicator for a same-key replay of either commit outcome', () => {
    const replayingFailure = resolveSwapView(swapInput({rememberedOutcome: 'failed', isAttemptPending: true}))
    const replayingUnknown = resolveSwapView(swapInput({rememberedOutcome: 'unconfirmed', isAttemptPending: true}))

    expect(replayingFailure.kind).toBe('retrying')
    expect(replayingUnknown.kind).toBe('retrying')
    expect(rendersOutcomeRetrySpinner(replayingFailure)).toBe(true)
    expect(rendersOutcomeRetrySpinner(replayingUnknown)).toBe(true)
  })

  // A settled outcome is acted on, not waited for: drawing a spinner beside it would report a request that is
  // not running.
  it('draws no indicator for a settled commit outcome', () => {
    const failed = resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}))
    const unconfirmed = resolveSwapView(swapInput({swapError: transportError()}))

    expect(failed.kind).toBe('failed')
    expect(unconfirmed.kind).toBe('unconfirmed')
    expect(rendersOutcomeRetrySpinner(failed)).toBe(false)
    expect(rendersOutcomeRetrySpinner(unconfirmed)).toBe(false)
  })

  // 13c's own spinner row is the loading state's, and a read's retry spins inside its banner's button: neither
  // is this indicator, which belongs to the commit being reconciled.
  it('draws no indicator for any other view', () => {
    const otherViews: [SwapView['kind'], SwapView][] = [
      ['list', resolveSwapView(swapInput())],
      ['empty', resolveSwapView(swapInput({alternatives: []}))],
      ['loading', resolveSwapView(swapInput({isAlternativesPending: true, alternatives: undefined}))],
      ['error', resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))],
      ['error', resolveSwapView(swapInput({currentMeal: null, dayError: transportError()}))],
      ['terminal', resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}))],
      ['terminal', resolveSwapView(swapInput({dayError: apiError(503, API_ERROR_CODES.featureDisabled)}))]
    ]

    otherViews.forEach(([kind, view]) => {
      expect(view.kind).toBe(kind)
      expect(rendersOutcomeRetrySpinner(view)).toBe(false)
    })
  })

  // The indicator tracks the replay and not the suppression: a pending attempt with no earlier outcome is a
  // silent cold-start replay, which must leave 13/13c/13d exactly as they are.
  it('draws no indicator for a silent replay that has no outcome to redraw', () => {
    const silent = resolveSwapView(swapInput({isAttemptPending: true}))

    expect(silent.kind).toBe('list')
    expect(rendersOutcomeRetrySpinner(silent)).toBe(false)
  })
})

describe('retiresPendingIntent', () => {
  it('retires the intent for a terminal refusal of the swap itself, so the next attempt mints a new key', () => {
    expect(
      retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)})))
    ).toBe(true)
    expect(
      retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(422, API_ERROR_CODES.recipeIneligible)})))
    ).toBe(true)
    expect(
      retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.previewStale)})))
    ).toBe(true)
  })

  // A read may not resolve a keyed write: the plan having moved on says nothing about whether the swap committed.
  it('keeps the intent when only the day query refused, however terminal that answer is', () => {
    expect(
      retiresPendingIntent(resolveSwapView(swapInput({dayError: apiError(409, API_ERROR_CODES.planNotActive)})))
    ).toBe(false)
    expect(retiresPendingIntent(resolveSwapView(swapInput({dayError: apiError(409, API_ERROR_CODES.stalePlan)})))).toBe(
      false
    )
  })

  // The cold-start replay window: the key is on disk and its request is in flight, so no `swapError` exists yet.
  // Retiring the key on the day's answer here would abandon a swap that may already be durable.
  it('keeps the intent during a silent replay, before any swap answer exists', () => {
    const view = resolveSwapView(
      swapInput({swapError: null, dayError: apiError(409, API_ERROR_CODES.planNotActive), isDayPending: false})
    )

    expect(view.kind).toBe('terminal')
    expect(retiresPendingIntent(view)).toBe(false)
  })

  // A confirmed `502 swap_failed` persisted nothing (0.5.2), so it resolves the action like any other confirmed
  // refusal and its key may never be replayed — `SwapPreview` retires the identical answer identically.
  it('retires the intent for a confirmed swap_failed, so 13e Try again mints a fresh key', () => {
    const view = resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}))

    expect(view.kind).toBe('failed')
    expect(retiresPendingIntent(view)).toBe(true)
  })

  // The one outcome that keeps its key: the request may have committed before its response was lost, so the key
  // is the only way to ask again without risking a second swap.
  it('keeps the intent for an unconfirmed outcome, so Try again replays the same key', () => {
    const view = resolveSwapView(swapInput({swapError: transportError()}))

    expect(view.kind).toBe('unconfirmed')
    expect(retiresPendingIntent(view)).toBe(false)
  })

  it('keeps the intent for every state that reports no server refusal', () => {
    const withoutRefusal = [
      resolveSwapView(swapInput()),
      resolveSwapView(swapInput({alternatives: []})),
      resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined})),
      resolveSwapView(swapInput({currentMeal: null, isDayPending: true})),
      resolveSwapView(swapInput({currentMeal: null, dayError: transportError()}))
    ]

    withoutRefusal.forEach(view => expect(retiresPendingIntent(view)).toBe(false))
  })
})

describe('resolveBannerSlot', () => {
  // 13e draws the error above the title because the commit is what the screen is about. A read's failure is
  // not: the title and the current-meal card stay, and the alternatives area is what it replaces (0.2.5).
  it('puts every commit outcome above the title', () => {
    const outcomes = [
      swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}),
      swapInput({swapError: transportError()}),
      swapInput({rememberedOutcome: 'failed', isAttemptPending: true}),
      swapInput({rememberedOutcome: 'unconfirmed', isAttemptPending: true})
    ]

    outcomes.forEach(input => expect(resolveBannerSlot(resolveSwapView(input))).toBe('aboveTitle'))
  })

  it('puts the alternatives-read failure in the alternatives area', () => {
    const view = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined}))

    expect(view.kind === 'error' ? view.retry : null).toBe('alternatives')
    expect(resolveBannerSlot(view)).toBe('alternatives')
  })

  // With no meal decoded there is no title and no card to sit under, so the body is the whole screen.
  it('puts the day-read failure there too', () => {
    const view = resolveSwapView(swapInput({currentMeal: null, dayError: transportError()}))

    expect(view.kind === 'error' ? view.retry : null).toBe('day')
    expect(resolveBannerSlot(view)).toBe('alternatives')
  })

  it('answers null for every view that draws no banner', () => {
    const withoutBanner = [
      swapInput(),
      swapInput({alternatives: []}),
      swapInput({isAlternativesPending: true, alternatives: undefined}),
      swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)})
    ]

    withoutBanner.forEach(input => {
      const view = resolveSwapView(input)

      expect(bannerOf(view)).toBeNull()
      expect(resolveBannerSlot(view)).toBeNull()
    })
  })

  it('names a slot for exactly the views that carry a banner', () => {
    const everyView = [
      swapInput(),
      swapInput({alternatives: []}),
      swapInput({isAlternativesPending: true, alternatives: undefined}),
      swapInput({alternativesError: transportError(), alternatives: undefined}),
      swapInput({currentMeal: null, dayError: transportError()}),
      swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)}),
      swapInput({swapError: transportError()}),
      swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}),
      swapInput({rememberedOutcome: 'failed', isAttemptPending: true})
    ]

    everyView.forEach(input => {
      const view = resolveSwapView(input)

      expect(resolveBannerSlot(view) === null).toBe(bannerOf(view) === null)
    })
  })
})

describe('resolveAlternativesTrust', () => {
  const ANSWERED_AT = 1_760_000_000_000

  it('trusts the list while nothing has contradicted it', () => {
    expect(resolveAlternativesTrust({contradictedAt: null, alternativesUpdatedAt: ANSWERED_AT})).toBe(true)
    expect(resolveAlternativesTrust({contradictedAt: null, alternativesUpdatedAt: 0})).toBe(true)
  })

  it('withdraws trust from a list that answered before the refusal', () => {
    expect(resolveAlternativesTrust({contradictedAt: ANSWERED_AT + 1, alternativesUpdatedAt: ANSWERED_AT})).toBe(false)
  })

  it('restores trust once the list has answered after the refusal', () => {
    expect(resolveAlternativesTrust({contradictedAt: ANSWERED_AT, alternativesUpdatedAt: ANSWERED_AT + 1})).toBe(true)
  })

  // Which of the two came first cannot be told apart at equal timestamps, and a spinner costs less than a
  // commit against a revision the server has already refused.
  it('treats a list that answered in the same millisecond as the older of the two', () => {
    expect(resolveAlternativesTrust({contradictedAt: ANSWERED_AT, alternativesUpdatedAt: ANSWERED_AT})).toBe(false)
  })

  it('withdraws trust from a key that has never answered', () => {
    expect(resolveAlternativesTrust({contradictedAt: ANSWERED_AT, alternativesUpdatedAt: 0})).toBe(false)
  })
})

describe('terminalRecoveryKey', () => {
  const terminalOf = (view: SwapView): SwapTerminalOutcome | null => (view.kind === 'terminal' ? view.terminal : null)

  const swapRefusal = (code: string): SwapTerminalOutcome => {
    const terminal = terminalOf(resolveSwapView(swapInput({swapError: apiError(409, code)})))

    if (terminal === null) {
      throw new Error(`expected ${code} to resolve to a terminal refusal`)
    }

    return terminal
  }

  const readRefusal = (code: string): SwapTerminalOutcome => {
    const terminal = terminalOf(resolveSwapView(swapInput({dayError: apiError(409, code)})))

    if (terminal === null) {
      throw new Error(`expected ${code} to resolve to a terminal refusal`)
    }

    return terminal
  }

  // The defect this closes: two commits refused the same way are two outcomes, and the second still owes its
  // toast, its re-read and its intent retirement. Keyed by the code alone, the second is silently skipped.
  it('separates two attempts refused with the same code', () => {
    const refusal = swapRefusal(API_ERROR_CODES.stalePlan)

    expect(terminalRecoveryKey(refusal, 10)).not.toBe(terminalRecoveryKey(refusal, 20))
  })

  it('answers the same key for the same attempt, so one outcome earns one recovery', () => {
    const refusal = swapRefusal(API_ERROR_CODES.stalePlan)

    expect(terminalRecoveryKey(refusal, 10)).toBe(terminalRecoveryKey(refusal, 10))
  })

  it('separates two codes within one attempt', () => {
    expect(terminalRecoveryKey(swapRefusal(API_ERROR_CODES.stalePlan), 10)).not.toBe(
      terminalRecoveryKey(swapRefusal(API_ERROR_CODES.previewStale), 10)
    )
  })

  // A read has no attempt behind it, so its code is its identity: answering the same refusal again earns no
  // second toast and no second re-read.
  it('identifies a read refusal by its code alone, whatever attempt is on record', () => {
    const refusal = readRefusal(API_ERROR_CODES.planNotActive)

    expect(terminalRecoveryKey(refusal, 10)).toBe(API_ERROR_CODES.planNotActive)
    expect(terminalRecoveryKey(refusal, 20)).toBe(API_ERROR_CODES.planNotActive)
    expect(terminalRecoveryKey(refusal, null)).toBe(API_ERROR_CODES.planNotActive)
  })

  it('falls back to the code when a swap refusal has no attempt submission to key on', () => {
    expect(terminalRecoveryKey(swapRefusal(API_ERROR_CODES.stalePlan), null)).toBe(API_ERROR_CODES.stalePlan)
  })
})

describe('resolveOutcomeMemory', () => {
  const ATTEMPT_KEY = 'idem-1'

  const OTHER_KEY = 'idem-2'

  const memoryInput = (overrides: Partial<OutcomeMemoryInput> = {}): OutcomeMemoryInput => ({
    attemptKey: ATTEMPT_KEY,
    viewKind: 'failed',
    isAttemptPending: false,
    memory: null,
    ...overrides
  })

  it('remembers a confirmed failure and an unknown outcome against the key that earned it', () => {
    expect(resolveOutcomeMemory(memoryInput())).toEqual({attemptKey: ATTEMPT_KEY, outcome: 'failed'})
    expect(resolveOutcomeMemory(memoryInput({viewKind: 'unconfirmed'}))).toEqual({
      attemptKey: ATTEMPT_KEY,
      outcome: 'unconfirmed'
    })
  })

  it('returns the record it already holds rather than an equal copy', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'failed'}

    expect(resolveOutcomeMemory(memoryInput({memory}))).toBe(memory)
  })

  it('replaces the record when the same key answers with the other outcome', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'failed'}

    expect(resolveOutcomeMemory(memoryInput({viewKind: 'unconfirmed', memory}))).toEqual({
      attemptKey: ATTEMPT_KEY,
      outcome: 'unconfirmed'
    })
  })

  // The window the whole helper exists for: the retry is in flight, the mutation cache reports no error, and
  // the outcome has to survive until the server answers that key.
  it('keeps the record while the same key is in flight, whatever the view is', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'unconfirmed'}
    const inFlightKinds: SwapView['kind'][] = ['retrying', 'loading', 'list', 'empty', 'error', 'terminal']

    inFlightKinds.forEach(viewKind =>
      expect(resolveOutcomeMemory(memoryInput({viewKind, isAttemptPending: true, memory}))).toBe(memory)
    )
  })

  it('drops the record once the view has resolved to anything but an outcome of its own', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'failed'}
    const settledKinds: SwapView['kind'][] = ['loading', 'list', 'empty', 'error', 'terminal']

    settledKinds.forEach(viewKind => expect(resolveOutcomeMemory(memoryInput({viewKind, memory}))).toBeNull())
  })

  // A different key is a different request: inheriting this outcome would report a failure the new commit
  // never earned, and would let its banner replay the wrong key.
  it('drops the record when the attempt key changes, even while a request is in flight', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: OTHER_KEY, outcome: 'failed'}

    expect(resolveOutcomeMemory(memoryInput({viewKind: 'retrying', isAttemptPending: true, memory}))).toBeNull()
    expect(resolveOutcomeMemory(memoryInput({viewKind: 'unconfirmed', memory}))).toEqual({
      attemptKey: ATTEMPT_KEY,
      outcome: 'unconfirmed'
    })
  })

  it('remembers nothing once the intent has been retired and no key is on record', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'failed'}

    expect(resolveOutcomeMemory(memoryInput({attemptKey: null, memory}))).toBeNull()
    expect(resolveOutcomeMemory(memoryInput({attemptKey: null, viewKind: 'failed', memory}))).toBeNull()
  })

  it('leaves the record it was given untouched', () => {
    const memory: SwapOutcomeMemoryRecord = {attemptKey: ATTEMPT_KEY, outcome: 'failed'}

    resolveOutcomeMemory(memoryInput({viewKind: 'unconfirmed', memory}))

    expect(memory).toEqual({attemptKey: ATTEMPT_KEY, outcome: 'failed'})
  })

  // The screen's ref holds the value this returned on the previous render, so a chain of passes is what it
  // really sees: a failure drawn, its retry fired, and the next failure drawn under the same key.
  it('carries one attempt through failure, replay and the next answer', () => {
    const drawn = resolveOutcomeMemory(memoryInput())
    const replaying = resolveOutcomeMemory(memoryInput({viewKind: 'retrying', isAttemptPending: true, memory: drawn}))
    const answered = resolveOutcomeMemory(memoryInput({viewKind: 'unconfirmed', memory: replaying}))
    const resolved = resolveOutcomeMemory(memoryInput({viewKind: 'list', memory: answered}))

    expect(replaying).toBe(drawn)
    expect(answered).toEqual({attemptKey: ATTEMPT_KEY, outcome: 'unconfirmed'})
    expect(resolved).toBeNull()
  })
})

describe('rememberedOutcomeForAttempt', () => {
  it('answers with the outcome held for the key now on record', () => {
    expect(rememberedOutcomeForAttempt({attemptKey: 'idem-1', outcome: 'failed'}, 'idem-1')).toBe('failed')
    expect(rememberedOutcomeForAttempt({attemptKey: 'idem-1', outcome: 'unconfirmed'}, 'idem-1')).toBe('unconfirmed')
  })

  it('answers null for another key, for no key and for no record', () => {
    expect(rememberedOutcomeForAttempt({attemptKey: 'idem-1', outcome: 'failed'}, 'idem-2')).toBeNull()
    expect(rememberedOutcomeForAttempt({attemptKey: 'idem-1', outcome: 'failed'}, null)).toBeNull()
    expect(rememberedOutcomeForAttempt(null, 'idem-1')).toBeNull()
    expect(rememberedOutcomeForAttempt(null, null)).toBeNull()
  })
})

describe('isPlanInactive', () => {
  it('is false while the plan still accepts writes', () => {
    expect(isPlanInactive(true)).toBe(false)
  })

  // The envelope reports `isWritable: false` for both ways a plan stops accepting writes — a regeneration
  // replaced it, or its week has finished, which storage still records as 'active'.
  it('is true once the plan has stopped accepting writes', () => {
    expect(isPlanInactive(false)).toBe(true)
  })

  it('is false before the day query has answered', () => {
    expect(isPlanInactive(null)).toBe(false)
    expect(isPlanInactive(undefined)).toBe(false)
  })
})

describe('isPlanRevisionStale', () => {
  it('is false when the plan still carries the revision the screen opened with', () => {
    expect(isPlanRevisionStale(4, 4)).toBe(false)
  })

  it('is true when the plan has moved on, in either direction', () => {
    expect(isPlanRevisionStale(5, 4)).toBe(true)
    expect(isPlanRevisionStale(3, 4)).toBe(true)
  })

  it('is false before the day query has answered', () => {
    expect(isPlanRevisionStale(null, 4)).toBe(false)
    expect(isPlanRevisionStale(undefined, 4)).toBe(false)
  })

  it('is false for a first revision that matches', () => {
    expect(isPlanRevisionStale(0, 0)).toBe(false)
  })

  // The two answer different questions, so neither implies the other: a writable plan can have moved on, and a
  // plan that no longer accepts writes can still carry the revision the screen opened with.
  it('is independent of whether the plan still accepts writes', () => {
    expect(isPlanInactive(true)).toBe(false)
    expect(isPlanRevisionStale(5, 4)).toBe(true)
    expect(isPlanInactive(false)).toBe(true)
    expect(isPlanRevisionStale(4, 4)).toBe(false)
  })
})

describe('buildSwapTitle', () => {
  it('names the slot being replaced, as frame 13 draws it', () => {
    expect(buildSwapTitle('lunch')).toBe('Swap your lunch')
  })

  it('reads naturally for every slot', () => {
    expect(buildSwapTitle('breakfast')).toBe('Swap your breakfast')
    expect(buildSwapTitle('dinner')).toBe('Swap your dinner')
    expect(buildSwapTitle('snack')).toBe('Swap your snack')
  })

  it('renders the exported template rather than a copy of the sentence', () => {
    expect(buildSwapTitle('lunch')).toBe(stringWithNamedParameters(SWAP_TITLE_TEMPLATE, {slot: 'lunch'}))
  })

  it('leaves no placeholder unreplaced for any slot', () => {
    MEAL_SLOTS.forEach(slot => expect(buildSwapTitle(slot)).not.toContain('{'))
  })
})

describe('currentMealEyebrow', () => {
  it('labels the card plainly while a replacement is being chosen', () => {
    expect(currentMealEyebrow('default', 'lunch')).toBe('Current meal')
  })

  it('states the meal is unchanged when nothing else matches the slot', () => {
    expect(currentMealEyebrow('unchanged', 'lunch')).toBe('Current meal, unchanged')
  })

  it('names the kept meal after a confirmed failure', () => {
    expect(currentMealEyebrow('stillYours', 'lunch')).toBe('Still your lunch')
    expect(currentMealEyebrow('stillYours', 'breakfast')).toBe('Still your breakfast')
  })
})

describe('buildNoAlternativesBody', () => {
  it('names the slot nothing matched', () => {
    expect(buildNoAlternativesBody('lunch')).toBe(
      'Nothing else matches your targets, cooking time, and dislikes for lunch this week.'
    )
  })
})

describe('buildSwapDateLabel', () => {
  it('reads as the header of frame 13 draws it', () => {
    expect(buildSwapDateLabel('2025-07-05')).toBe('Sat, Jul 5')
  })

  it('labels the last day of the drawn week', () => {
    expect(buildSwapDateLabel('2025-07-11')).toBe('Fri, Jul 11')
  })

  it('reads the day key as a local calendar day rather than as UTC midnight', () => {
    expect(buildSwapDateLabel('2026-01-01')).toBe('Thu, Jan 1')
  })
})

describe('buildMealMetaText', () => {
  it('composes the alternative row meta frame 13 draws', () => {
    expect(buildMealMetaText({calories: 540, protein: 38, totalMinutes: 15})).toBe('540 cal · 38g protein · 15 min')
  })

  it('composes the current meal meta from the same function', () => {
    const meal = plannedMeal()

    expect(
      buildMealMetaText({
        calories: meal.planned.calories,
        protein: meal.planned.protein,
        totalMinutes: meal.recipe.totalMinutes
      })
    ).toBe('610 cal · 45g protein · 25 min')
  })

  it('drops a missing protein value with its separator', () => {
    const meta = buildMealMetaText({calories: 540, protein: null, totalMinutes: 15})

    expect(meta).toBe('540 cal · 15 min')
    expect(meta).not.toContain('NaN')
    expect(meta).not.toContain('· ·')
  })

  it('drops an undefined or non-finite protein value the same way', () => {
    expect(buildMealMetaText({calories: 540, protein: undefined, totalMinutes: 15})).toBe('540 cal · 15 min')
    expect(buildMealMetaText({calories: 540, protein: Number.NaN, totalMinutes: 15})).toBe('540 cal · 15 min')
    expect(buildMealMetaText({calories: 540, protein: Number.POSITIVE_INFINITY, totalMinutes: 15})).toBe(
      '540 cal · 15 min'
    )
  })

  it('drops any other missing segment without stranding a separator', () => {
    expect(buildMealMetaText({calories: null, protein: 38, totalMinutes: 15})).toBe('38g protein · 15 min')
    expect(buildMealMetaText({calories: 540, protein: 38, totalMinutes: null})).toBe('540 cal · 38g protein')
    expect(buildMealMetaText({calories: null, protein: 38, totalMinutes: null})).toBe('38g protein')
  })

  it('renders nothing when the response carried no figures at all', () => {
    expect(buildMealMetaText({calories: null, protein: null, totalMinutes: null})).toBe('')
  })

  it('rounds every figure once and groups thousands as the diary does', () => {
    expect(buildMealMetaText({calories: 1204.6, protein: 38.4, totalMinutes: 14.6})).toBe(
      '1,205 cal · 38g protein · 15 min'
    )
  })

  it('keeps a zero figure rather than dropping it', () => {
    expect(buildMealMetaText({calories: 0, protein: 0, totalMinutes: 0})).toBe('0 cal · 0g protein · 0 min')
  })

  it('reads a zero figure as a real value, never as a missing one', () => {
    expect(buildMealMetaText({calories: 540, protein: 0, totalMinutes: 15})).not.toBe(
      buildMealMetaText({calories: 540, protein: null, totalMinutes: 15})
    )
    expect(buildMealMetaText({calories: 540, protein: 0, totalMinutes: 15})).toBe('540 cal · 0g protein · 15 min')
  })
})

describe('SKELETON_ALTERNATIVE_ROWS', () => {
  it('describes the three placeholder rows frame 13c draws', () => {
    expect(SKELETON_ALTERNATIVE_ROWS).toHaveLength(3)
  })

  it('reproduces every Figma bar width when applied to the 269px reference column', () => {
    const widths = proportionsInRowOrder().map(proportion => proportion * REFERENCE_TEXT_COLUMN)

    widths.forEach((width, index) => expect(width).toBeCloseTo(FIGMA_BAR_WIDTHS[index], 1))
  })

  it('keeps every proportion a fraction of the column', () => {
    proportionsInRowOrder().forEach(proportion => {
      expect(proportion).toBeGreaterThan(0)
      expect(proportion).toBeLessThan(1)
    })
  })

  it('keeps the primary bar wider than the secondary bar in every row', () => {
    SKELETON_ALTERNATIVE_ROWS.forEach(row => expect(row.primary).toBeGreaterThan(row.secondary))
  })

  it('gives every row exactly the two bars the frame draws', () => {
    SKELETON_ALTERNATIVE_ROWS.forEach(row => {
      expect(Object.keys(row)).toHaveLength(2)
      expect(Object.keys(row).sort()).toEqual(['primary', 'secondary'])
    })
  })

  it('freezes the row list and every row in it, so no render can resize the skeleton', () => {
    expect(Object.isFrozen(SKELETON_ALTERNATIVE_ROWS)).toBe(true)
    SKELETON_ALTERNATIVE_ROWS.forEach(row => expect(Object.isFrozen(row)).toBe(true))
  })

  it('keeps every proportion at its Figma value after a write is attempted', () => {
    attemptRowWrite(SKELETON_ALTERNATIVE_ROWS[0])

    expect(SKELETON_ALTERNATIVE_ROWS[0]).toEqual({primary: 0.72, secondary: 0.48})
  })
})

describe('skeletonBarWidth', () => {
  it('applies each proportion to the measured 393px-reference column', () => {
    const widths = proportionsInRowOrder().map(proportion => skeletonBarWidth(REFERENCE_TEXT_COLUMN, proportion))

    expect(widths).toEqual([194, 129, 156, 108, 178, 140])
  })

  it('scales down with the measured column on a 375px device', () => {
    const widths = proportionsInRowOrder().map(proportion => skeletonBarWidth(NARROW_TEXT_COLUMN, proportion))

    expect(widths).toEqual([181, 120, 146, 100, 166, 131])
  })

  it('never exceeds the column it is measured against', () => {
    proportionsInRowOrder().forEach(proportion =>
      expect(skeletonBarWidth(NARROW_TEXT_COLUMN, proportion)).toBeLessThan(NARROW_TEXT_COLUMN)
    )
  })

  it('returns no width before the column has been measured', () => {
    expect(skeletonBarWidth(0, SKELETON_ALTERNATIVE_ROWS[0].primary)).toBe(0)
    expect(skeletonBarWidth(-1, SKELETON_ALTERNATIVE_ROWS[0].primary)).toBe(0)
  })

  it('returns whole pixels', () => {
    proportionsInRowOrder().forEach(proportion =>
      expect(Number.isInteger(skeletonBarWidth(REFERENCE_TEXT_COLUMN, proportion))).toBe(true)
    )
  })

  it('leaves the proportion table untouched', () => {
    const before = proportionsInRowOrder()

    proportionsInRowOrder().forEach(proportion => skeletonBarWidth(REFERENCE_TEXT_COLUMN, proportion))

    expect(proportionsInRowOrder()).toEqual(before)
  })
})

describe('buildSwapRequest', () => {
  const INPUTS = {
    planId: 'plan-1',
    mealId: 'meal-1',
    recipeVersionId: 'rv-1',
    portionMultiplier: 1.25,
    planRevision: 3
  }

  it('names the meal being replaced, the alternative and the portion the preview bound', () => {
    expect(buildSwapRequest(INPUTS)).toEqual({
      action: 'swap',
      planId: 'plan-1',
      mealId: 'meal-1',
      recipeVersionId: 'rv-1',
      portionMultiplier: 1.25,
      expectedPlanRevision: 3
    })
  })

  // A commit whose response was lost is replayed from these inputs alone, so identical inputs have to rebuild
  // an identical request — anything else would mint a second key and swap the meal twice.
  it('rebuilds an identical request from identical inputs', () => {
    expect(buildSwapRequest(INPUTS)).toEqual(buildSwapRequest({...INPUTS}))
  })

  it('differs when the chosen alternative or the portion differs', () => {
    expect(buildSwapRequest({...INPUTS, recipeVersionId: 'rv-2'})).not.toEqual(buildSwapRequest(INPUTS))
    expect(buildSwapRequest({...INPUTS, portionMultiplier: 1})).not.toEqual(buildSwapRequest(INPUTS))
  })

  it('carries the plan revision the screen opened on as the revision the write expects', () => {
    expect(buildSwapRequest({...INPUTS, planRevision: 9}).expectedPlanRevision).toBe(9)
  })
})

const USER_ID = 'user-1'

const OTHER_USER_ID = 'user-2'

const PLAN_ID = 'plan-1'

const MEAL_ID = 'meal-1'

const NOW = 1_760_000_000_000

const STORED_KEY = 'idem-stored'

const FRESH_KEY = 'idem-fresh'

const OPENED_REVISION = 4

const swapSnapshot = (overrides: Partial<Omit<SwapRequestSnapshot, 'action'>> = {}): SwapRequestSnapshot => ({
  action: 'swap',
  planId: PLAN_ID,
  mealId: MEAL_ID,
  recipeVersionId: 'recipe-version-wrap',
  portionMultiplier: 1,
  expectedPlanRevision: OPENED_REVISION,
  ...overrides
})

const storedIntent = (snapshot: SwapRequestSnapshot = swapSnapshot(), userId: string = USER_ID): PendingIntent =>
  buildPendingIntent(snapshot, STORED_KEY, userId, NOW)

const stateWith = (intent: PendingIntent | null): Pick<MealPlanStore, 'pendingIntents'> => ({
  pendingIntents: intent === null ? {} : {swap: intent}
})

// The view the screen is actually holding when a swap commit came back without an answer, derived rather than
// asserted so the classification stays the util's.
const unconfirmedView = (dayError: unknown = null): SwapView =>
  resolveSwapView({
    currentMeal: plannedMeal(),
    alternatives: undefined,
    isAlternativesPending: false,
    isAlternativesFetching: false,
    isAlternativesTrusted: true,
    alternativesError: null,
    swapError: axiosError(),
    rememberedOutcome: null,
    isAttemptPending: false,
    isDayPending: false,
    dayError
  })

interface ScreenPass {
  guards: SwapAttemptGuards
  currentPlanRefetches: number
  planDayRefetches: number
  retiredIntents: PendingIntentAction[]
}

const freshPass = (): ScreenPass => ({
  guards: guardsForNewAttempt(),
  currentPlanRefetches: 0,
  planDayRefetches: 0,
  retiredIntents: []
})

// The outcome of the first commit fired from the preview screen, and of a second one fired from it later while
// this screen stayed mounted. Same idempotency key, because the preview re-records the key it replays; different
// submission, because they are different attempts.
const FIRST_ATTEMPT_KEY = unconfirmedRefetchKey(STORED_KEY, NOW)

const SECOND_ATTEMPT_KEY = unconfirmedRefetchKey(STORED_KEY, NOW + 30_000)

/**
 * The unconfirmed effect of `index.tsx`, step for step: read the guard, ask for the decision, write the guard
 * back, refetch the current plan and the plan day. The retire branch is here on purpose — the screen has none —
 * so that "the intent survives" is an assertion about the decision rather than about this simulator: it would
 * retire the intent the moment the decision allowed it.
 *
 * The attempt key is a parameter because it is what the screen passes in: the guard is per-attempt, so a pass
 * carrying a later commit's outcome runs the same effect under a different key.
 */
const runUnconfirmedEffect = (
  viewKind: SwapView['kind'],
  pass: ScreenPass,
  attemptRefetchKey: string | null = FIRST_ATTEMPT_KEY
): ScreenPass => {
  const decision = resolveUnconfirmedRefetch({
    viewKind,
    attemptRefetchKey,
    refetchedUnconfirmedKey: pass.guards.refetchedUnconfirmedKey
  })

  if (!decision.refetchesCurrentPlan && !decision.refetchesPlanDay) {
    return pass
  }

  return {
    guards: {...pass.guards, refetchedUnconfirmedKey: decision.refetchedUnconfirmedKey},
    currentPlanRefetches: pass.currentPlanRefetches + (decision.refetchesCurrentPlan ? 1 : 0),
    planDayRefetches: pass.planDayRefetches + (decision.refetchesPlanDay ? 1 : 0),
    retiredIntents: decision.resolvesPendingIntent ? [...pass.retiredIntents, 'swap'] : pass.retiredIntents
  }
}

describe('resolveUnconfirmedRefetch', () => {
  describe('with an unconfirmed commit outcome', () => {
    // 0.2.5 names both reads: the day is what shows the swapped meal, the current plan is what the tab behind
    // this screen renders from, and a commit this attempt may already have made moved both.
    it('asks for the current plan and the plan day together', () => {
      const decision = resolveUnconfirmedRefetch({
        viewKind: 'unconfirmed',
        attemptRefetchKey: FIRST_ATTEMPT_KEY,
        refetchedUnconfirmedKey: null
      })
      const pass = runUnconfirmedEffect('unconfirmed', freshPass())

      expect(decision.refetchesCurrentPlan).toBe(true)
      expect(decision.refetchesPlanDay).toBe(true)
      expect(pass.currentPlanRefetches).toBe(1)
      expect(pass.planDayRefetches).toBe(1)
    })

    it('refetches both exactly once, however many times the effect re-runs', () => {
      const first = runUnconfirmedEffect('unconfirmed', freshPass())
      const second = runUnconfirmedEffect('unconfirmed', first)
      const third = runUnconfirmedEffect('unconfirmed', second)

      expect(first.planDayRefetches).toBe(1)
      expect(first.currentPlanRefetches).toBe(1)
      expect(third.planDayRefetches).toBe(1)
      expect(third.currentPlanRefetches).toBe(1)
      expect(third.guards.refetchedUnconfirmedKey).toBe(FIRST_ATTEMPT_KEY)
    })

    it('refetches not at all when this attempt has already earned its pair', () => {
      const decision = resolveUnconfirmedRefetch({
        viewKind: 'unconfirmed',
        attemptRefetchKey: FIRST_ATTEMPT_KEY,
        refetchedUnconfirmedKey: FIRST_ATTEMPT_KEY
      })
      const guarded: ScreenPass = {
        ...freshPass(),
        guards: {recoveredTerminalKey: null, refetchedUnconfirmedKey: FIRST_ATTEMPT_KEY}
      }
      const pass = runUnconfirmedEffect('unconfirmed', guarded)

      expect(decision.refetchesCurrentPlan).toBe(false)
      expect(decision.refetchesPlanDay).toBe(false)
      expect(decision.refetchedUnconfirmedKey).toBe(FIRST_ATTEMPT_KEY)
      expect(pass.currentPlanRefetches).toBe(0)
      expect(pass.planDayRefetches).toBe(0)
    })

    // The gap both SWAP-F05 and OBSEV-F06 name: the commit is fired from the preview screen, which resets
    // nothing here, so a second unknown outcome arrives at a still-mounted SwapMeal whose guard is already
    // written. Keyed by the attempt, that second outcome earns its own pair; keyed by the mount, it earned none
    // and a committed swap could stay invisible until the user retried or navigated.
    it('refetches both again for a later preview-originated outcome on the same mounted screen', () => {
      const firstOutcome = runUnconfirmedEffect('unconfirmed', freshPass(), FIRST_ATTEMPT_KEY)
      const redrawn = runUnconfirmedEffect('unconfirmed', firstOutcome, FIRST_ATTEMPT_KEY)

      // "Back to alternatives", another candidate opened, another commit fired from the preview — nothing on
      // this screen reset a guard in between, which is exactly the point.
      const secondOutcome = runUnconfirmedEffect('unconfirmed', redrawn, SECOND_ATTEMPT_KEY)
      const secondRedrawn = runUnconfirmedEffect('unconfirmed', secondOutcome, SECOND_ATTEMPT_KEY)

      expect(redrawn.currentPlanRefetches).toBe(1)
      expect(redrawn.planDayRefetches).toBe(1)
      expect(secondOutcome.currentPlanRefetches).toBe(2)
      expect(secondOutcome.planDayRefetches).toBe(2)
      expect(secondRedrawn.currentPlanRefetches).toBe(2)
      expect(secondRedrawn.planDayRefetches).toBe(2)
      expect(secondRedrawn.guards.refetchedUnconfirmedKey).toBe(SECOND_ATTEMPT_KEY)
      expect(secondRedrawn.retiredIntents).toEqual([])
    })

    // A guard that cannot be written cannot hold, so an outcome with no attempt behind it earns nothing: the
    // effect re-runs on every query-identity change, and refetching there would read on every render.
    it('refetches nothing when no attempt identifies the outcome', () => {
      const decision = resolveUnconfirmedRefetch({
        viewKind: 'unconfirmed',
        attemptRefetchKey: null,
        refetchedUnconfirmedKey: null
      })
      const pass = runUnconfirmedEffect('unconfirmed', freshPass(), null)

      expect(decision.refetchesCurrentPlan).toBe(false)
      expect(decision.refetchesPlanDay).toBe(false)
      expect(decision.refetchedUnconfirmedKey).toBeNull()
      expect(pass.currentPlanRefetches).toBe(0)
      expect(pass.planDayRefetches).toBe(0)
    })

    // A key already earned is never forgotten by a render that refetches nothing: were it dropped, the next
    // render of the same outcome would read again.
    it('keeps the earned key while no attempt identifies the render', () => {
      const earned = runUnconfirmedEffect('unconfirmed', freshPass(), FIRST_ATTEMPT_KEY)

      expect(
        resolveUnconfirmedRefetch({
          viewKind: 'unconfirmed',
          attemptRefetchKey: null,
          refetchedUnconfirmedKey: earned.guards.refetchedUnconfirmedKey
        }).refetchedUnconfirmedKey
      ).toBe(FIRST_ATTEMPT_KEY)
    })

    it('never resolves the pending intent, so the stored key survives both refetches', () => {
      const intent = storedIntent()
      const state = stateWith(intent)
      const pass = runUnconfirmedEffect(unconfirmedView().kind, freshPass())

      expect(pass.currentPlanRefetches).toBe(1)
      expect(pass.planDayRefetches).toBe(1)
      expect(pass.retiredIntents).toEqual([])
      expect(resolvePendingIntent(state, 'swap', USER_ID, NOW)).toEqual(intent)
    })

    it('leaves the intent and the state alone when the day query answers stale_plan at the same time', () => {
      const intent = storedIntent()
      const state = stateWith(intent)
      const view = unconfirmedView(axiosError(409, {error: API_ERROR_CODES.stalePlan}))

      const decision = resolveUnconfirmedRefetch({
        viewKind: view.kind,
        attemptRefetchKey: FIRST_ATTEMPT_KEY,
        refetchedUnconfirmedKey: null
      })
      const pass = runUnconfirmedEffect(view.kind, freshPass())

      expect(view.kind).toBe('unconfirmed')
      expect(retiresPendingIntent(view)).toBe(false)
      expect(decision.refetchesCurrentPlan).toBe(true)
      expect(decision.refetchesPlanDay).toBe(true)
      expect(decision.resolvesPendingIntent).toBe(false)
      expect(pass.retiredIntents).toEqual([])
      expect(resolvePendingIntent(state, 'swap', USER_ID, NOW)).toEqual(intent)
    })

    // The in-place retry clears the guard as its request leaves, which earns the same pair a second time even
    // before the new submission renames the key.
    it('refetches both again for the next outcome once a new attempt has reset the guard', () => {
      const refetched = runUnconfirmedEffect('unconfirmed', freshPass())
      const blocked = runUnconfirmedEffect('unconfirmed', refetched)

      const afterRetryPressed: ScreenPass = {...blocked, guards: guardsForNewAttempt()}
      const refetchedAgain = runUnconfirmedEffect('unconfirmed', afterRetryPressed)

      expect(blocked.planDayRefetches).toBe(1)
      expect(blocked.currentPlanRefetches).toBe(1)
      expect(refetchedAgain.planDayRefetches).toBe(2)
      expect(refetchedAgain.currentPlanRefetches).toBe(2)
    })
  })

  describe('with any other view', () => {
    const otherKinds: SwapView['kind'][] = ['loading', 'list', 'empty', 'error', 'failed', 'retrying', 'terminal']

    it.each(otherKinds)('does not refetch for the %s view and leaves the guard untouched', kind => {
      const decision = resolveUnconfirmedRefetch({
        viewKind: kind,
        attemptRefetchKey: FIRST_ATTEMPT_KEY,
        refetchedUnconfirmedKey: null
      })
      const pass = runUnconfirmedEffect(kind, freshPass())

      expect(decision.refetchesCurrentPlan).toBe(false)
      expect(decision.refetchesPlanDay).toBe(false)
      expect(decision.refetchedUnconfirmedKey).toBeNull()
      expect(pass.currentPlanRefetches).toBe(0)
      expect(pass.planDayRefetches).toBe(0)
    })

    // The replay of an unknown outcome is the same attempt still in flight, so it earns no second pair: its own
    // answer is the next outcome, and a reset guard is what lets that one refetch.
    it('keeps a guard already earned by an unconfirmed outcome through the replay and a terminal refusal', () => {
      const guarded: UnconfirmedRefetchDecision = {
        refetchesCurrentPlan: false,
        refetchesPlanDay: false,
        resolvesPendingIntent: false,
        refetchedUnconfirmedKey: FIRST_ATTEMPT_KEY
      }

      expect(
        resolveUnconfirmedRefetch({
          viewKind: 'terminal',
          attemptRefetchKey: FIRST_ATTEMPT_KEY,
          refetchedUnconfirmedKey: FIRST_ATTEMPT_KEY
        })
      ).toEqual(guarded)
      expect(
        resolveUnconfirmedRefetch({
          viewKind: 'retrying',
          attemptRefetchKey: SECOND_ATTEMPT_KEY,
          refetchedUnconfirmedKey: FIRST_ATTEMPT_KEY
        })
      ).toEqual(guarded)
    })
  })
})

describe('unconfirmedRefetchKey', () => {
  it('composes the attempt key and its submission, so one outcome is one key', () => {
    expect(unconfirmedRefetchKey(STORED_KEY, NOW)).toBe(`${STORED_KEY}:${NOW}`)
    expect(unconfirmedRefetchKey(STORED_KEY, NOW)).toBe(unconfirmedRefetchKey(STORED_KEY, NOW))
  })

  // A replay re-sends the same idempotency key, so the key alone cannot tell two attempts apart: the submission
  // is what does, and that is what earns the later outcome its own pair of reads.
  it('separates two submissions of the same idempotency key', () => {
    expect(unconfirmedRefetchKey(STORED_KEY, NOW)).not.toBe(unconfirmedRefetchKey(STORED_KEY, NOW + 30_000))
    expect(unconfirmedRefetchKey(STORED_KEY, NOW)).not.toBe(unconfirmedRefetchKey(FRESH_KEY, NOW))
  })

  it('answers null unless both parts identify an attempt', () => {
    expect(unconfirmedRefetchKey(null, NOW)).toBeNull()
    expect(unconfirmedRefetchKey(STORED_KEY, null)).toBeNull()
    expect(unconfirmedRefetchKey(null, null)).toBeNull()
  })
})

describe('guardsForNewAttempt', () => {
  it('clears both per-attempt guards so the new attempt earns its own recovery and refetch', () => {
    expect(guardsForNewAttempt()).toEqual({recoveredTerminalKey: null, refetchedUnconfirmedKey: null})
  })
})

describe('resolveSwapRetryPlan', () => {
  it('replays the stored key while the request still fingerprints to the stored intent', () => {
    const intent = storedIntent()

    const plan = resolveSwapRetryPlan({
      state: stateWith(intent),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + 5_000,
      freshKey: FRESH_KEY
    })

    expect(plan.isReplay).toBe(true)
    expect(plan.idempotencyKey).toBe(STORED_KEY)
    expect(plan.request).toEqual(intent.request)
    expect(plan.variables).toEqual({
      mealId: MEAL_ID,
      payload: {
        recipeVersionId: 'recipe-version-wrap',
        portionMultiplier: 1,
        expectedPlanRevision: OPENED_REVISION,
        idempotencyKey: STORED_KEY
      }
    })
  })

  it('mints the fresh key when the stored intent describes a different request', () => {
    const plan = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({recipeVersionId: 'recipe-version-salad'}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + 5_000,
      freshKey: FRESH_KEY
    })

    expect(plan.isReplay).toBe(false)
    expect(plan.idempotencyKey).toBe(FRESH_KEY)
    expect(plan.variables.payload).toEqual({
      recipeVersionId: 'recipe-version-wrap',
      portionMultiplier: 1,
      expectedPlanRevision: OPENED_REVISION,
      idempotencyKey: FRESH_KEY
    })
  })

  it('mints the fresh key when the portion or the revision the preview bound has moved', () => {
    const movedRevision = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({expectedPlanRevision: OPENED_REVISION + 1}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    const movedPortion = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({portionMultiplier: 1.5}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    expect(movedRevision.idempotencyKey).toBe(FRESH_KEY)
    expect(movedPortion.idempotencyKey).toBe(FRESH_KEY)
  })

  it('mints the fresh key when nothing is on record, and when the record has expired or belongs to another user', () => {
    const nothingStored = resolveSwapRetryPlan({
      state: stateWith(null),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    const expired = resolveSwapRetryPlan({
      state: stateWith(storedIntent()),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + PENDING_INTENT_TTL_MS,
      freshKey: FRESH_KEY
    })

    const anotherUser = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot(), OTHER_USER_ID)),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    expect(nothingStored.idempotencyKey).toBe(FRESH_KEY)
    expect(expired.idempotencyKey).toBe(FRESH_KEY)
    expect(anotherUser.idempotencyKey).toBe(FRESH_KEY)
  })

  it('returns an intent that describes the request actually in flight', () => {
    const attemptedAt = NOW + 9_000

    const plan = resolveSwapRetryPlan({
      state: stateWith(storedIntent()),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt,
      freshKey: FRESH_KEY
    })

    expect(plan.intent.key).toBe(plan.idempotencyKey)
    expect(plan.intent.userId).toBe(USER_ID)
    expect(plan.intent.createdAt).toBe(attemptedAt)
    expect(plan.intent.request).toEqual(plan.request)
    expect(matchesFingerprint(plan.request, plan.intent.fingerprint)).toBe(true)
  })
})

describe('resolveReplayableSwap', () => {
  it('answers with the stored request for this user, plan and meal, and the key it was minted for', () => {
    const intent = storedIntent()

    const attempt = resolveReplayableSwap({
      state: stateWith(intent),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    // The key travels with the request because it is what identifies the attempt in the shared mutation cache:
    // without it the screen has no way to match the outcome of a commit the preview screen fired.
    expect(attempt).toEqual({key: intent.key, request: intent.request})
    expect(attempt?.key).toBe(STORED_KEY)
  })

  it('answers null when there is no signed-in user to scope the record to', () => {
    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent()),
        userId: null,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW
      })
    ).toBeNull()
  })

  it('answers null for a record about another meal or another plan', () => {
    const otherMeal = resolveReplayableSwap({
      state: stateWith(storedIntent(swapSnapshot({mealId: 'meal-9'}))),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    const otherPlan = resolveReplayableSwap({
      state: stateWith(storedIntent(swapSnapshot({planId: 'plan-9'}))),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    expect(otherMeal).toBeNull()
    expect(otherPlan).toBeNull()
  })

  it('answers null for an expired record, for another user and for an empty slice', () => {
    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent()),
        userId: USER_ID,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW + PENDING_INTENT_TTL_MS
      })
    ).toBeNull()

    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent(swapSnapshot(), OTHER_USER_ID)),
        userId: USER_ID,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW
      })
    ).toBeNull()

    expect(
      resolveReplayableSwap({state: stateWith(null), userId: USER_ID, planId: PLAN_ID, mealId: MEAL_ID, now: NOW})
    ).toBeNull()
  })
})

describe('selectSwapAttemptState', () => {
  // The shape a swap commit's mutation-cache entry really has: `useSwapMealMutation(planId, mealId)` closes
  // over both ids, so the variables are a bare payload and the idempotency key is the only field that can tie
  // an entry back to the pending intent recorded beside it.
  type TestState = KeyedMutationState & {status: string; error: Error | null}

  const entry = (idempotencyKey: string | null, submittedAt: number, status = 'error'): TestState => ({
    submittedAt,
    status,
    error: status === 'error' ? new Error('swap_failed') : null,
    variables:
      idempotencyKey === null
        ? {recipeVersionId: 'recipe-1', portionMultiplier: 1, expectedPlanRevision: 3}
        : {recipeVersionId: 'recipe-1', portionMultiplier: 1, expectedPlanRevision: 3, idempotencyKey}
  })

  it('answers with the entry whose variables carry the attempt key', () => {
    const mine = entry(STORED_KEY, 10)

    expect(selectSwapAttemptState([entry('idem-other', 5), mine, entry('idem-later', 20)], STORED_KEY)).toBe(mine)
  })

  it('answers null when there is no unresolved attempt to match', () => {
    // A null key is the resolved case — the intent was retired by a server answer — and draws no banner even
    // while the cache still holds the entry that resolved it.
    expect(selectSwapAttemptState([entry(STORED_KEY, 10)], null)).toBeNull()
  })

  it('answers null when no entry carries the key, and for an empty cache', () => {
    expect(selectSwapAttemptState([entry('idem-other', 10)], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([], STORED_KEY)).toBeNull()
  })

  it('answers with the latest submission when a replay re-sends the same key', () => {
    const replay = entry(STORED_KEY, 30)

    // A replay sends the identical key, so the cache holds two entries for one attempt and the newer one is the
    // outcome now on screen. Order in the array must not decide it.
    expect(selectSwapAttemptState([replay, entry(STORED_KEY, 10)], STORED_KEY)).toBe(replay)
    expect(selectSwapAttemptState([entry(STORED_KEY, 10), replay], STORED_KEY)).toBe(replay)
  })

  it('ignores entries whose variables carry no usable key', () => {
    // Nothing may be inferred from an entry that cannot be attributed: variables are typed `unknown` at the
    // cache boundary, so a missing or non-string key is skipped rather than matched loosely.
    expect(selectSwapAttemptState([entry(null, 10)], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: undefined}], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: {idempotencyKey: 7}}], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: 'idem-stored'}], STORED_KEY)).toBeNull()
  })

  it('preserves the entry type so the caller keeps its own status and error', () => {
    const pending = entry(STORED_KEY, 10, 'pending')

    expect(selectSwapAttemptState([pending], STORED_KEY)?.status).toBe('pending')
    expect(selectSwapAttemptState([entry(STORED_KEY, 10)], STORED_KEY)?.error).toBeInstanceOf(Error)
  })
})

describe('resolveAlternativesRevision', () => {
  it('selects the revision the day query reports when it is newer than the one the screen opened on', () => {
    expect(
      resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION + 1, openedPlanRevision: OPENED_REVISION})
    ).toBe(OPENED_REVISION + 1)
  })

  it('selects the day revision even when it is older, because the list must match the plan the day describes', () => {
    expect(
      resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION - 1, openedPlanRevision: OPENED_REVISION})
    ).toBe(OPENED_REVISION - 1)
  })

  it('keeps the opened revision while the day query agrees or has not answered', () => {
    expect(resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
    expect(resolveAlternativesRevision({dayPlanRevision: undefined, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
    expect(resolveAlternativesRevision({dayPlanRevision: null, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
  })
})

describe('resolveSwapCommitPayload', () => {
  it('sends the stored snapshot under the stored key, byte-identical to the request the key was minted for', () => {
    const snapshot = swapSnapshot()
    const intent = storedIntent(snapshot)
    const attempt: SwapAttempt = {key: intent.key, request: snapshot}

    // Compared with the wire body IdempotencyUtility builds from the same snapshot: the replay the server
    // answers with its stored result is the one whose body reproduces the fingerprinted request (0.7.2).
    expect(resolveSwapCommitPayload(attempt)).toEqual(requestBody(intent.request, intent.key))
    expect(resolveSwapCommitPayload(attempt)).toEqual({
      recipeVersionId: 'recipe-version-wrap',
      portionMultiplier: 1,
      expectedPlanRevision: OPENED_REVISION,
      idempotencyKey: STORED_KEY
    })
  })

  it('carries the alternative, portion and revision the STORED request names, not the ones the screen now holds', () => {
    // The screen reopened on revision 4 showing the wrap; the unresolved commit was for a different candidate
    // at a different portion against an older revision. Rebuilding any of those from current state is what
    // earns `409 idempotency_conflict` or commits a second swap.
    const stored = swapSnapshot({
      recipeVersionId: 'recipe-version-salad',
      portionMultiplier: 1.5,
      expectedPlanRevision: 2
    })

    expect(resolveSwapCommitPayload({key: STORED_KEY, request: stored})).toEqual({
      recipeVersionId: 'recipe-version-salad',
      portionMultiplier: 1.5,
      expectedPlanRevision: 2,
      idempotencyKey: STORED_KEY
    })
  })
})

describe('resolveSwapMountReplay', () => {
  const attempt = (snapshot: SwapRequestSnapshot = swapSnapshot(), key: string = STORED_KEY): SwapAttempt => ({
    key,
    request: snapshot
  })

  const READY: SwapMountReplayInput = {
    attempt: attempt(),
    hasHydratedIntents: true,
    userId: USER_ID,
    isCommitInFlight: false,
    replayedKey: null
  }

  it('replays the unresolved commit once, latching its key and carrying its stored body', () => {
    expect(resolveSwapMountReplay(READY)).toEqual({
      replays: true,
      replayedKey: STORED_KEY,
      payload: requestBody(swapSnapshot(), STORED_KEY)
    })
  })

  it('reads the intent out of persisted state, so a cold start replays without any in-memory attempt', () => {
    // The whole path the screen takes on a launch that found the mutation cache empty: the persisted slice is
    // the only trace of the request, and it is enough to re-send it under its own key.
    const restored = resolveReplayableSwap({
      state: stateWith(storedIntent()),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    const replay = resolveSwapMountReplay({...READY, attempt: restored})

    expect(replay.replays).toBe(true)
    expect(replay.payload).toEqual(requestBody(storedIntent().request, STORED_KEY))
  })

  it('does not replay the same key twice', () => {
    expect(resolveSwapMountReplay({...READY, replayedKey: STORED_KEY})).toEqual({
      replays: false,
      replayedKey: STORED_KEY,
      payload: null
    })
  })

  it('replays a later attempt recorded under a new key', () => {
    // A key the screen has not sent is a different intent, and it earns its own replay however the record
    // reached the store.
    expect(
      resolveSwapMountReplay({...READY, attempt: attempt(swapSnapshot(), FRESH_KEY), replayedKey: STORED_KEY})
    ).toEqual({
      replays: true,
      replayedKey: FRESH_KEY,
      payload: requestBody(swapSnapshot(), FRESH_KEY)
    })
  })

  it('waits while the persisted slice has not arrived, leaving the latch untouched', () => {
    // 'Nothing is pending' and 'the answer has not arrived' are different answers: deciding on the first frame
    // is what lets the next press mint a second key for a request the server may already hold.
    expect(resolveSwapMountReplay({...READY, hasHydratedIntents: false})).toEqual({
      replays: false,
      replayedKey: null,
      payload: null
    })

    expect(resolveSwapMountReplay({...READY, hasHydratedIntents: false, replayedKey: STORED_KEY}).replayedKey).toBe(
      STORED_KEY
    )
  })

  it('waits while there is no signed-in account to judge ownership with', () => {
    expect(resolveSwapMountReplay({...READY, userId: null})).toEqual({
      replays: false,
      replayedKey: null,
      payload: null
    })
  })

  it('does not replay while a commit for this key is already on the wire', () => {
    expect(resolveSwapMountReplay({...READY, isCommitInFlight: true})).toEqual({
      replays: false,
      replayedKey: null,
      payload: null
    })
  })

  it('does nothing when no unresolved commit is on record', () => {
    expect(resolveSwapMountReplay({...READY, attempt: null})).toEqual({
      replays: false,
      replayedKey: null,
      payload: null
    })
  })

  /**
   * The mount effect of `index.tsx`, step for step: ask for the decision, write the latch back, send the stored
   * body when told to. Run repeatedly because the effect re-runs on every render of the screen — the one thing
   * that must not happen is a second request for a key already sent.
   */
  const runMountEffect = (input: SwapMountReplayInput, sent: string[]): {latch: string | null; sent: string[]} => {
    const replay = resolveSwapMountReplay(input)

    if (!replay.replays || replay.payload === null) {
      return {latch: replay.replayedKey, sent}
    }

    return {latch: replay.replayedKey, sent: [...sent, String(replay.payload.idempotencyKey)]}
  }

  it('sends the stored key exactly once however many times the effect re-runs', () => {
    const first = runMountEffect(READY, [])
    const second = runMountEffect({...READY, replayedKey: first.latch}, first.sent)
    const third = runMountEffect({...READY, replayedKey: second.latch}, second.sent)

    expect(third.sent).toEqual([STORED_KEY])
  })

  it('sends nothing until hydration lands, then sends the restored key once', () => {
    const waiting = runMountEffect({...READY, hasHydratedIntents: false, attempt: null}, [])
    const hydrated = runMountEffect({...READY, replayedKey: waiting.latch}, waiting.sent)
    const settled = runMountEffect({...READY, replayedKey: hydrated.latch, isCommitInFlight: true}, hydrated.sent)

    expect(waiting.sent).toEqual([])
    expect(settled.sent).toEqual([STORED_KEY])
  })
})

describe('resolveSwapSlotOwnership', () => {
  const ownershipOf = (intent: PendingIntent | null, userId: string | null = USER_ID, now: number = NOW) =>
    resolveSwapSlotOwnership({state: stateWith(intent), userId, planId: PLAN_ID, mealId: MEAL_ID, now})

  it("reports this plan and meal's own unresolved commit as mine", () => {
    expect(ownershipOf(storedIntent())).toBe('mine')
  })

  it('reports an empty slot as free', () => {
    expect(ownershipOf(null)).toBe('free')
  })

  it('reports a record for another meal or another plan as FOREIGN, not as an empty slot', () => {
    // The distinction this whole decision exists for: `resolveReplayableSwap` answers null for both, and
    // acting on that null is how meal B's preview minted a second key over meal A's unresolved one (0.7.2).
    expect(ownershipOf(storedIntent(swapSnapshot({mealId: 'meal-9'})))).toBe('foreign')
    expect(ownershipOf(storedIntent(swapSnapshot({planId: 'plan-9'})))).toBe('foreign')

    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent(swapSnapshot({mealId: 'meal-9'}))),
        userId: USER_ID,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW
      })
    ).toBeNull()
  })

  it('reports an expired record, another account and no signed-in account as free', () => {
    expect(ownershipOf(storedIntent(), USER_ID, NOW + PENDING_INTENT_TTL_MS)).toBe('free')
    expect(ownershipOf(storedIntent(swapSnapshot(), OTHER_USER_ID))).toBe('free')
    expect(ownershipOf(storedIntent(), null)).toBe('free')
  })
})

describe('resolveSwapInteraction', () => {
  const unresolved: SwapInteractionInput = {
    ownership: 'mine',
    hasHydratedIntents: true,
    viewKind: 'list',
    isCommitInFlight: false,
    hasBanner: false
  }

  it('withholds the alternatives while a commit is unresolved, and says the screen is busy instead', () => {
    // The preview records its own intent in the single `swap` slot, so an openable row is a route to
    // overwriting the only key that can reconcile the unresolved write (0.7.2).
    expect(resolveSwapInteraction(unresolved)).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: true,
      showsForeignHoldNotice: false
    })
  })

  it('opens the alternatives once nothing is unresolved', () => {
    expect(resolveSwapInteraction({...unresolved, ownership: 'free'})).toEqual({
      allowsAlternativeSelection: true,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })
  })

  it('withholds them while ANOTHER plan or meal holds the swap slot, and says why', () => {
    // The verifier's case: the slot is taken by a swap this screen cannot answer for, so the rows — every one
    // of them a route into the preview that records an intent — go away, and the screen states that rather
    // than reading as "no alternatives for this slot".
    expect(resolveSwapInteraction({...unresolved, ownership: 'foreign'})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: true
    })
  })

  it('withholds them for a foreign holder in every view the list can be drawn from', () => {
    const kinds: SwapInteractionInput['viewKind'][] = ['list', 'failed', 'terminal', 'empty', 'loading']

    kinds.forEach(viewKind => {
      expect(resolveSwapInteraction({...unresolved, ownership: 'foreign', viewKind}).allowsAlternativeSelection).toBe(
        false
      )
    })
  })

  it('leaves the foreign notice to a banner the view already draws', () => {
    expect(resolveSwapInteraction({...unresolved, ownership: 'foreign', hasBanner: true})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })
  })

  it('withholds them before the persisted slice has arrived, when a pending key is not yet knowable', () => {
    // Fail-closed, and the reason is hydration rather than the holder: an unread slice may already hold a key
    // for this meal or for any other, so nothing is claimed about the slot until the read succeeds.
    expect(resolveSwapInteraction({...unresolved, ownership: 'free', hasHydratedIntents: false})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })

    expect(
      resolveSwapInteraction({...unresolved, ownership: 'foreign', hasHydratedIntents: false}).showsForeignHoldNotice
    ).toBe(false)
  })

  it('withholds them while any swap commit is on the wire', () => {
    expect(resolveSwapInteraction({...unresolved, ownership: 'free', isCommitInFlight: true})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })
  })

  it('keeps 13e interactive: a confirmed swap_failed answered that nothing was written', () => {
    expect(resolveSwapInteraction({...unresolved, viewKind: 'failed', hasBanner: true})).toEqual({
      allowsAlternativeSelection: true,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })
  })

  it('keeps them away for a terminal READ refusal, which says nothing about whether the swap committed', () => {
    expect(resolveSwapInteraction({...unresolved, viewKind: 'terminal'})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: true,
      showsForeignHoldNotice: false
    })
  })

  it('leaves the busy state to the view that already draws one', () => {
    const kinds: SwapInteractionInput['viewKind'][] = ['loading', 'empty']

    kinds.forEach(viewKind => {
      expect(resolveSwapInteraction({...unresolved, viewKind}).showsCommitBusyState).toBe(false)
    })

    expect(resolveSwapInteraction({...unresolved, viewKind: 'unconfirmed', hasBanner: true})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: false
    })
  })

  /**
   * The verifier's cold start, end to end at the decision level: the process died with meal A's commit
   * unresolved, the mutation cache came back empty, and the user opened meal B. Everything this screen knows
   * comes out of the persisted slice, and it must not offer a row whose preview would record a second key.
   */
  it('blocks meal B on a cold start while meal A holds the slot, from persisted state alone', () => {
    const state = stateWith(storedIntent(swapSnapshot({mealId: 'meal-a', recipeVersionId: 'recipe-version-soup'})))

    const ownership = resolveSwapSlotOwnership({
      state,
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: 'meal-b',
      now: NOW
    })

    const replayable = resolveReplayableSwap({state, userId: USER_ID, planId: PLAN_ID, mealId: 'meal-b', now: NOW})

    expect(ownership).toBe('foreign')
    expect(replayable).toBeNull()
    expect(resolveSwapInteraction({...unresolved, ownership})).toEqual({
      allowsAlternativeSelection: false,
      showsCommitBusyState: false,
      showsForeignHoldNotice: true
    })
  })
})

/**
 * The two resolutions of 13c's wait that are NOT banners. Every banner announces itself from inside
 * `InfoBanner`, so this resolver's silence on those states is what keeps a failure from being spoken twice.
 */
describe('resolveAlternativesAnnouncement', () => {
  it('reports how many alternatives arrived', () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'list', listedCount: 4, slot: 'dinner'})).toBe(
      'Alternatives, 4 found'
    )
  })

  it('reports a single alternative in the same sentence', () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'list', listedCount: 1, slot: 'lunch'})).toBe(
      'Alternatives, 1 found'
    )
  })

  // The overline is drawn from the rows, and an unresolved commit holding the swap slot withholds every one of
  // them: announcing a count over an empty area would report a list the user cannot reach.
  it('says nothing while the rows are withheld, however many the view carries', () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'list', listedCount: 0, slot: 'dinner'})).toBeNull()
  })

  it("speaks 13d's headline and the body that qualifies it as one sentence", () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'empty', listedCount: 0, slot: 'lunch'})).toBe(
      'No alternatives for this slot. Nothing else matches your targets, cooking time, and dislikes for lunch this week.'
    )
  })

  // 13d is drawn only with the meal known, and the body names its slot: without one there is no card on screen
  // and no sentence to speak about it.
  it('says nothing for an empty result before the meal has decoded', () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'empty', listedCount: 0, slot: null})).toBeNull()
  })

  it('leaves every banner state to the banner that announces itself', () => {
    const bannerKinds: SwapView['kind'][] = ['error', 'failed', 'unconfirmed', 'retrying', 'terminal']

    bannerKinds.forEach(viewKind =>
      expect(resolveAlternativesAnnouncement({viewKind, listedCount: 0, slot: 'dinner'})).toBeNull()
    )
  })

  it('says nothing while the outcome is still loading', () => {
    expect(resolveAlternativesAnnouncement({viewKind: 'loading', listedCount: 0, slot: 'breakfast'})).toBeNull()
  })
})

/**
 * The guard the screen's announcement effect runs, and the sequences that made it necessary.
 *
 * Driven as a sequence rather than a set of single calls, because what the guard decides depends on what was
 * last spoken: the alternatives area genuinely returns to 13c's wait — the query key changes with the
 * authoritative plan revision, and an unresolved commit withholds every row — and it routinely resolves to the
 * same copy afterwards. A guard that only compared messages left those second resolutions silent.
 */
describe('resolveAnnouncementGuard', () => {
  // The screen's effect, verbatim: resolve the message, ask the guard, hold what it returns. The effect's
  // dependency is the message, so a render that recomputes the same string does not re-enter it — modelled here
  // so the sequences read as the screen behaves.
  const announcedThrough = (steps: readonly AlternativesAnnouncementInput[]): readonly string[] => {
    const spoken: string[] = []
    let lastAnnounced: string | null = null
    let lastMessage: string | null = null
    let isFirstStep = true

    steps.forEach(step => {
      const message = resolveAlternativesAnnouncement(step)

      if (!isFirstStep && message === lastMessage) {
        return
      }

      isFirstStep = false
      lastMessage = message

      const decision = resolveAnnouncementGuard(message, lastAnnounced)

      lastAnnounced = decision.lastAnnounced

      if (decision.announces !== null) {
        spoken.push(decision.announces)
      }
    })

    return spoken
  }

  const listed = (count: number): AlternativesAnnouncementInput => ({
    viewKind: 'list',
    listedCount: count,
    slot: 'lunch'
  })

  const waiting: AlternativesAnnouncementInput = {viewKind: 'loading', listedCount: 0, slot: 'lunch'}

  const noResults: AlternativesAnnouncementInput = {viewKind: 'empty', listedCount: 0, slot: 'lunch'}

  it('announces a resolution the screen returns to, even with the count unchanged', () => {
    expect(announcedThrough([listed(4), waiting, listed(4)])).toEqual([
      'Alternatives, 4 found',
      'Alternatives, 4 found'
    ])
  })

  it("announces 13d again when the same slot's wait resolves to no results a second time", () => {
    const sentence =
      'No alternatives for this slot. Nothing else matches your targets, cooking time, and dislikes for lunch this week.'

    expect(announcedThrough([noResults, waiting, noResults])).toEqual([sentence, sentence])
  })

  // The withheld case reaches the guard as a null of its own — an unresolved commit owns the swap slot, so no
  // row is drawn — and the rows that come back are a resolution the user has not been told about yet.
  it('announces rows restored after a commit withheld them, at the same count', () => {
    expect(announcedThrough([listed(4), listed(0), listed(4)])).toEqual([
      'Alternatives, 4 found',
      'Alternatives, 4 found'
    ])
  })

  it('stays silent through a refetch that never leaves the resolved list', () => {
    expect(announcedThrough([listed(4), listed(4), listed(4)])).toEqual(['Alternatives, 4 found'])
  })

  it('announces a count that changes without the list going away', () => {
    expect(announcedThrough([listed(4), listed(3)])).toEqual(['Alternatives, 4 found', 'Alternatives, 3 found'])
  })

  it('announces copy that differs after a wait, as it always did', () => {
    expect(announcedThrough([listed(4), waiting, noResults])).toEqual([
      'Alternatives, 4 found',
      'No alternatives for this slot. Nothing else matches your targets, cooking time, and dislikes for lunch this week.'
    ])
  })

  it('clears what it holds when there is nothing resolved on screen', () => {
    expect(resolveAnnouncementGuard(null, 'Alternatives, 4 found')).toEqual({
      announces: null,
      lastAnnounced: null
    })
  })

  // Not only React's dependency check: a StrictMode double-invoke, or a remount that re-enters the effect with
  // the resolution still on screen, must not repeat it either.
  it('repeats nothing while the message it last spoke is still the message', () => {
    expect(resolveAnnouncementGuard('Alternatives, 4 found', 'Alternatives, 4 found')).toEqual({
      announces: null,
      lastAnnounced: 'Alternatives, 4 found'
    })
  })

  it('speaks a message it has not spoken before and holds it', () => {
    expect(resolveAnnouncementGuard('Alternatives, 2 found', null)).toEqual({
      announces: 'Alternatives, 2 found',
      lastAnnounced: 'Alternatives, 2 found'
    })
  })
})
