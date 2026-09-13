import {MealPlanMeal} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative} from '@data/models/SwapAlternative'

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

const apiError = (status: number, code: string): unknown => ({response: {status, data: {error: code}}})

const transportError = (): unknown => new Error('Network Error')

const undecodableError = (): unknown => ({response: {status: 502, data: '<html>gateway</html>'}})

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
      const view = resolveSwapView(swapInput({dayError: apiError(409, 'stale_plan')}))

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
        swapInput({currentMeal: null, isDayPending: true, dayError: apiError(409, 'plan_not_active')})
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

    it('keeps a failed request distinct from a decoded empty list', () => {
      const failedRequest = resolveSwapView(swapInput({alternativesError: transportError(), alternatives: []}))
      const emptyResponse = resolveSwapView(swapInput({alternatives: []}))

      expect(failedRequest.kind).toBe('error')
      expect(emptyResponse.kind).toBe('empty')
    })
  })

  describe('with a confirmed swap failure (13e)', () => {
    it('names the meal it left alone and outlines the current-meal card', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed')}))

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
        swapInput({currentMeal: plannedMeal('dinner'), swapError: apiError(502, 'swap_failed')})
      )

      expect(bannerOf(view)?.body).toBe('Your dinner is unchanged and your grocery list was not updated.')
    })

    it('keeps the alternatives list on screen', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed')}))

      expect(rendersAlternatives(view)).toBe(true)
      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([alternative()])
    })

    it('renders an empty list when the alternatives were never decoded', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed'), alternatives: undefined}))

      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
    })

    it('promises nothing about the plan when the meal is not known', () => {
      const view = resolveSwapView(swapInput({currentMeal: null, swapError: apiError(502, 'swap_failed')}))
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
      const view = resolveSwapView(swapInput({swapError: transportError(), dayError: apiError(409, 'stale_plan')}))

      expect(view.kind).toBe('unconfirmed')
      expect(retiresPendingIntent(view)).toBe(false)
      expect(bannerOf(view)?.title).toBe("We couldn't confirm that")
    })
  })

  describe('with a terminal swap refusal', () => {
    it('names a stale plan as terminal and keeps the alternatives on screen', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan')}))

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
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'plan_not_active')}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'plan_not_active',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'refetchPlan'
      })
    })

    it('sends the user back to the list when the preview it was built from went stale', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'preview_stale')}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'preview_stale',
        source: 'swap',
        toastText: 'Your plan changed. Try that again.',
        recovery: 'reselectAlternative'
      })
    })

    it('names an ineligible recipe as terminal and asks for another alternative', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(422, 'recipe_ineligible')}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'recipe_ineligible',
        source: 'swap',
        toastText: 'That meal no longer fits your plan.',
        recovery: 'reselectAlternative'
      })
    })

    it('asks for another alternative when the key was reused with a changed request', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'idempotency_conflict')}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'idempotency_conflict',
        source: 'swap',
        toastText: null,
        recovery: 'reselectAlternative'
      })
    })

    it('carries a confirmed code this release has no copy for without inventing any', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(400, 'invalid_request')}))

      expect(view.kind === 'terminal' ? view.terminal : null).toEqual({
        code: 'invalid_request',
        source: 'swap',
        toastText: null,
        recovery: 'refetchPlan'
      })
    })

    it('renders an empty list when the alternatives were never decoded', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan'), alternatives: undefined}))

      expect(rendersAlternatives(view)).toBe(true)
      expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
    })

    it('takes the default current-meal card, never the drawn 13e assurance', () => {
      const view = resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan')}))

      expect(view.currentMealVariant).toBe('default')
      expect(bannerOf(view)).toBeNull()
    })

    it('outranks an alternatives request that is still in flight', () => {
      const view = resolveSwapView(
        swapInput({swapError: apiError(409, 'stale_plan'), isAlternativesPending: true, alternatives: undefined})
      )

      expect(view.kind).toBe('terminal')
    })

    it('never reads an absent error as a refusal', () => {
      expect(resolveSwapView(swapInput({swapError: null})).kind).toBe('list')
      expect(resolveSwapView(swapInput({swapError: undefined})).kind).toBe('list')
    })
  })

  it('classifies the commit before the alternatives request that is still in flight', () => {
    const view = resolveSwapView(
      swapInput({swapError: apiError(502, 'swap_failed'), isAlternativesPending: true, alternatives: undefined})
    )

    expect(view.kind).toBe('failed')
  })
})

describe('rendersAlternatives', () => {
  it('renders the list for the alternatives state, for a confirmed failure and for a terminal refusal', () => {
    expect(rendersAlternatives(resolveSwapView(swapInput()))).toBe(true)
    expect(rendersAlternatives(resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed')})))).toBe(true)
    expect(rendersAlternatives(resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan')})))).toBe(true)
  })

  it('renders an empty terminal list rather than nothing when the alternatives were never decoded', () => {
    const view = resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan'), alternatives: undefined}))

    expect(rendersAlternatives(view)).toBe(true)
    expect(rendersAlternatives(view) ? view.alternatives : null).toEqual([])
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
    expect(retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(409, 'stale_plan')})))).toBe(true)
    expect(retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(422, 'recipe_ineligible')})))).toBe(true)
    expect(retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(409, 'preview_stale')})))).toBe(true)
  })

  // A read may not resolve a keyed write: the plan having moved on says nothing about whether the swap committed.
  it('keeps the intent when only the day query refused, however terminal that answer is', () => {
    expect(retiresPendingIntent(resolveSwapView(swapInput({dayError: apiError(409, 'plan_not_active')})))).toBe(false)
    expect(retiresPendingIntent(resolveSwapView(swapInput({dayError: apiError(409, 'stale_plan')})))).toBe(false)
  })

  // The cold-start replay window: the key is on disk and its request is in flight, so no `swapError` exists yet.
  // Retiring the key on the day's answer here would abandon a swap that may already be durable.
  it('keeps the intent during a silent replay, before any swap answer exists', () => {
    const view = resolveSwapView(
      swapInput({swapError: null, dayError: apiError(409, 'plan_not_active'), isDayPending: false})
    )

    expect(view.kind).toBe('terminal')
    expect(retiresPendingIntent(view)).toBe(false)
  })

  it('keeps the intent for a confirmed failure and an unconfirmed outcome, so Try again replays the same key', () => {
    expect(retiresPendingIntent(resolveSwapView(swapInput({swapError: apiError(502, 'swap_failed')})))).toBe(false)
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
  it('is false while the plan is active', () => {
    expect(isPlanInactive('active')).toBe(false)
  })

  it('is true once the plan has been superseded', () => {
    expect(isPlanInactive('superseded')).toBe(true)
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
