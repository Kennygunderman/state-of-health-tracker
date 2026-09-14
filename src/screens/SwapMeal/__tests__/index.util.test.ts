import {MealPlanMeal} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative} from '@data/models/SwapAlternative'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {AxiosError, AxiosResponse} from 'axios'

import {stringWithNamedParameters, SWAP_TITLE_TEMPLATE} from '@constants/strings'

import {
  buildMealMetaText,
  buildNoAlternativesBody,
  buildSwapDateLabel,
  buildSwapRequest,
  buildSwapTitle,
  currentMealEyebrow,
  isPlanInactive,
  isPlanRevisionStale,
  rendersAlternatives,
  resolveSwapView,
  retiresPendingIntent,
  SKELETON_ALTERNATIVE_ROWS,
  SkeletonAlternativeRow,
  skeletonBarWidth,
  SwapBannerContent,
  SwapView,
  SwapViewInput
} from '../index.util'

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
  alternativesError: null,
  swapError: null,
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

    it('keeps the list on screen so the recovery step never lands on a blank screen', () => {
      const view = resolveSwapView(swapInput({alternativesError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([alternative()])
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

  describe('with a terminal swap refusal', () => {
    it('names a stale plan as terminal and keeps the alternatives on screen', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)}))

      expect(view.kind).toBe('terminal')
      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'stale_plan',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([alternative()])
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

    it('renders an empty list when the alternatives were never decoded', () => {
      const view = resolveSwapView(
        swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan), alternatives: undefined})
      )

      expect(rendersAlternatives(view)).toBe(true)
      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
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

    it('still keeps the alternatives on screen, as every other terminal refusal does', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'toString')}))

      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([alternative()])
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
        swapInput({swapError: transportError()})
      ]

      inputs.forEach(input => expect(resolveSwapView(input)).toEqual(resolveSwapView(input)))
    })
  })
})

describe('rendersAlternatives', () => {
  it('renders the list for the alternatives state, for a confirmed failure and for a terminal refusal', () => {
    expect(rendersAlternatives(resolveSwapView(swapInput()))).toBe(true)
    expect(
      rendersAlternatives(resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)})))
    ).toBe(true)
    expect(rendersAlternatives(resolveSwapView(swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan)})))).toBe(
      true
    )
  })

  it('renders an empty terminal list rather than nothing when the alternatives were never decoded', () => {
    const view = resolveSwapView(
      swapInput({swapError: apiError(409, API_ERROR_CODES.stalePlan), alternatives: undefined})
    )

    expect(rendersAlternatives(view)).toBe(true)
    expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
  })

  it('renders the list for a refusal the alternatives query itself answered', () => {
    const decoded = resolveSwapView(swapInput({alternativesError: apiError(409, API_ERROR_CODES.planNotActive)}))
    const neverDecoded = resolveSwapView(
      swapInput({alternativesError: apiError(503, API_ERROR_CODES.featureDisabled), alternatives: undefined})
    )

    expect(rendersAlternatives(decoded) ? decoded.alternatives : null).toEqual([alternative()])
    expect(rendersAlternatives(neverDecoded)).toBe(true)
    expect(rendersAlternatives(neverDecoded) ? neverDecoded.alternatives : null).toEqual([])
  })

  it('renders no list while loading, when empty, on a failed request or on an unconfirmed outcome', () => {
    const withoutList = [
      resolveSwapView(swapInput({isAlternativesPending: true, alternatives: undefined})),
      resolveSwapView(swapInput({alternatives: []})),
      resolveSwapView(swapInput({alternativesError: transportError(), alternatives: undefined})),
      resolveSwapView(swapInput({swapError: transportError()}))
    ]

    withoutList.forEach(view => expect(rendersAlternatives(view)).toBe(false))
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

  it('keeps the intent for a confirmed failure and an unconfirmed outcome, so Try again replays the same key', () => {
    expect(
      retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(502, API_ERROR_CODES.swapFailed)})))
    ).toBe(false)
    expect(retiresPendingIntent(resolveSwapView(swapInput({swapError: transportError()})))).toBe(false)
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
