import {GroceryCategory, GroceryItem, GroceryItemFlag, GroceryList, GrocerySection} from '@data/models/GroceryList'
import {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import FontSize, {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNT_INCREASED_BODY_UNNAMED,
  GROCERY_AMOUNT_INCREASED_TITLE,
  GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
  GROCERY_CATEGORY_LABELS,
  GROCERY_CHECKED_HEADER_TEMPLATE,
  GROCERY_NO_PLAN_EYEBROW,
  GROCERY_UPDATED_AFTER_SWAP_TEMPLATE,
  GROCERY_UPDATED_AFTER_SWAP_TEXT,
  MEAL_PLAN_STALE_PLAN_TOAST,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import {UNCHECK_ALL_HIT_SLOP} from '../index.styled'
import {
  buildGroceryViewModel,
  classifyGroceryWriteFailure,
  contentColumnWidth,
  EMPTY_GROCERY_VIEW_MODEL,
  flaggedItemNames,
  groceryBanner,
  groceryCategoryLabel,
  groceryEyebrow,
  GroceryPlanScope,
  GroceryQueryState,
  groceryReadRecovery,
  groceryRowVariant,
  isGroceryPlanStateRefusal,
  orderCheckedItems,
  orderGrocerySections,
  resolveGroceryPlanScope,
  resolveGroceryView,
  shouldShowUncheckAll
} from '../index.util'

const PLAN_ID = 'plan-7c9f'
const START_DATE = '2026-07-05'
const END_DATE = '2026-07-11'
const PLAN_RANGE_TEXT = 'Jul 5 – Jul 11'
const CHECKED_PROGRESS_TEXT = '6 of 14 checked'
const FLAGGED_ITEM_NAME = 'Chicken breast'
const CURRENT_PLAN_ID = 'plan-current-3a1d'
const UPCOMING_PLAN_ID = 'plan-upcoming-9b4e'
const UNKNOWN_CATEGORY = 'frozen'
const UNKNOWN_MEAL_SLOT = 'brunch'
const INHERITED_KEY = 'toString'

// Names every copy table inherits from Object.prototype: a raw index returns a function (or, for __proto__, an
// object), which is not nullish and so would slip past the unknown-code fallback into rendered copy.
const PROTOTYPE_KEYS = ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']

const UNCHECK_ALL_SLOP_TOP = UNCHECK_ALL_HIT_SLOP.top ?? 0
const UNCHECK_ALL_SLOP_BOTTOM = UNCHECK_ALL_HIT_SLOP.bottom ?? 0

// eyebrowRow centres the action beside the overline, its 4px rung and the title, so this is the room the row
// leaves above and below the label's line box — and the most slop the row can carry before it clips the child.
const HEADER_ROW_SLACK_V = (LineHeight.OVERLINE + Spacing.XX_SMALL + LineHeight.SCREEN_TITLE - LineHeight.LABEL) / 2

const INCREASE_FLAG: GroceryItemFlag = {
  previousDisplayText: '2.5 lb',
  newDisplayText: '3.1 lb',
  deltaDisplayText: '+0.6 lb',
  flaggedAt: '2026-07-06T09:15:00.000Z'
}

const makeItem = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
  id: 'item-spinach',
  catalogFoodId: 'catalog-spinach',
  foodState: 'raw',
  name: 'Spinach',
  quantityGrams: 420,
  displayText: '7 cups',
  isChecked: false,
  flag: null,
  ...overrides
})

// Carries a name, because the banner is named from the flagged row rather than from the response's own
// snapshot: a flagged fixture that kept `makeItem`'s default name would assert nothing about which row the
// sentence points at.
const makeFlaggedItem = (id: string, name: string = FLAGGED_ITEM_NAME): GroceryItem =>
  makeItem({id, name, isChecked: true, flag: INCREASE_FLAG})

const makeSection = (category: GroceryCategory, items: GroceryItem[]): GrocerySection => ({category, items})

const makeUnknownSection = (category: string, items: GroceryItem[]): GrocerySection =>
  ({category, items}) as GrocerySection

const makeList = (overrides: Partial<GroceryList> = {}): GroceryList => ({
  planId: PLAN_ID,
  planRevision: 3,
  startDate: START_DATE,
  endDate: END_DATE,
  totalCount: 14,
  checkedCount: 0,
  banner: null,
  sections: [makeSection('produce', [makeItem()])],
  checkedItems: [],
  ...overrides
})

const makeQuery = (overrides: Partial<GroceryQueryState> = {}): GroceryQueryState => ({
  isLoading: false,
  isError: false,
  ...overrides
})

const makeScope = (planId: string): GroceryPlanScope => ({kind: 'plan', planId})

const PLAN_SCOPE: GroceryPlanScope = makeScope(PLAN_ID)
const NO_PLAN_SCOPE: GroceryPlanScope = {kind: 'noPlan'}
const RESOLVING_SCOPE: GroceryPlanScope = {kind: 'resolving'}
const UNAVAILABLE_SCOPE: GroceryPlanScope = {kind: 'unavailable'}

const makePlan = (id: string): MealPlan => ({
  id,
  revision: 3,
  generationKey: 'idem-generate-grocery',
  generationAttempt: 1,
  startDate: START_DATE,
  endDate: END_DATE,
  status: 'active',
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  generationTargets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  targetsStale: false,
  preferencesRevision: 4,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 14, loggedEntryCount: 0},
  days: []
})

const makePlans = (current: MealPlan | null, upcoming: MealPlan | null = null): CurrentMealPlans => ({
  current,
  upcoming
})

const apiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

// A gateway failure whose body happens to carry a plan-state code: an unknown outcome, so it earns a retry
// rather than the code's own copy.
const ECHOED_PLAN_CODE_ERROR = apiError(502, API_ERROR_CODES.stalePlan)

const UNDECODABLE_ERROR: unknown = {response: {status: 500, data: '<html>gateway</html>'}}

const NETWORK_ERROR = new Error('Network Error')

describe('resolveGroceryPlanScope', () => {
  describe('route plan id', () => {
    it('shops the plan the route names', () => {
      expect(
        resolveGroceryPlanScope({routePlanId: PLAN_ID, currentPlan: {isError: false, data: makePlans(null)}})
      ).toEqual(makeScope(PLAN_ID))
    })

    it('ignores the current-plan query entirely, because it is disabled when the route carries an id', () => {
      const ignored = [
        {isError: false, data: makePlans(makePlan(CURRENT_PLAN_ID))},
        {isError: true, data: undefined},
        {isError: false, data: undefined},
        {isError: true, data: makePlans(null)}
      ]

      ignored.forEach(currentPlan => {
        expect(resolveGroceryPlanScope({routePlanId: PLAN_ID, currentPlan})).toEqual(makeScope(PLAN_ID))
      })
    })

    // The pin outranks the whole answer, not just its `current` member: while the route names a plan, neither
    // of the two plans may take the screen over, so only dropping the pin can move this screen off it.
    it('wins over both a current and an upcoming plan', () => {
      expect(
        resolveGroceryPlanScope({
          routePlanId: PLAN_ID,
          currentPlan: {isError: false, data: makePlans(makePlan(CURRENT_PLAN_ID), makePlan(UPCOMING_PLAN_ID))}
        })
      ).toEqual(makeScope(PLAN_ID))
    })
  })

  describe('no route plan id', () => {
    it('shops the plan the user is on', () => {
      expect(
        resolveGroceryPlanScope({
          routePlanId: null,
          currentPlan: {isError: false, data: makePlans(makePlan(CURRENT_PLAN_ID))}
        })
      ).toEqual(makeScope(CURRENT_PLAN_ID))
    })

    it('keeps a cached plan when the current-plan read failed, so an offline session keeps shopping', () => {
      expect(
        resolveGroceryPlanScope({
          routePlanId: null,
          currentPlan: {isError: true, data: makePlans(makePlan(CURRENT_PLAN_ID))}
        })
      ).toEqual(makeScope(CURRENT_PLAN_ID))
    })

    it('prefers the current plan when both a current and an upcoming plan exist', () => {
      expect(
        resolveGroceryPlanScope({
          routePlanId: null,
          currentPlan: {isError: false, data: makePlans(makePlan(CURRENT_PLAN_ID), makePlan(UPCOMING_PLAN_ID))}
        })
      ).toEqual(makeScope(CURRENT_PLAN_ID))
    })

    // AAP 0.7.4 selects `current ?? upcoming` for an unset plan id, and it forbids a second upcoming plan — so
    // a user whose only plan starts next week has exactly one list to shop, and claiming "No active plan" with
    // a "Create my plan" CTA would both misreport it and offer something the plan rules refuse.
    it('shops the upcoming plan when there is no current plan', () => {
      expect(
        resolveGroceryPlanScope({
          routePlanId: null,
          currentPlan: {isError: false, data: makePlans(null, makePlan(UPCOMING_PLAN_ID))}
        })
      ).toEqual(makeScope(UPCOMING_PLAN_ID))
    })

    it('reports no plan once the server has said there is none', () => {
      expect(
        resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: false, data: makePlans(null)}})
      ).toEqual(NO_PLAN_SCOPE)
    })

    // The 14c body's one producer, and the state an unpinned screen degrades into: both members decoded and
    // both absent. Stated explicitly so the `?? upcoming` fallback can never be widened into swallowing it.
    it('reports no plan when the decoded answer holds neither a current nor an upcoming plan', () => {
      expect(
        resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: false, data: makePlans(null, null)}})
      ).toEqual(NO_PLAN_SCOPE)
    })

    it('reports the lookup unavailable when it failed with nothing cached', () => {
      expect(resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: true}})).toEqual(UNAVAILABLE_SCOPE)
    })

    it('stays resolving while the lookup has answered neither way', () => {
      expect(resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: false}})).toEqual(RESOLVING_SCOPE)
    })

    it('never turns a failed or pending lookup into the no-plan state', () => {
      // AAP 0.2.5 reserves 14c for decoded absence: a network failure may never claim the user has no plan.
      const kinds = [
        resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: true}}).kind,
        resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: false}}).kind,
        resolveGroceryPlanScope({routePlanId: null, currentPlan: {isError: false, data: makePlans(null)}}).kind
      ]

      expect(kinds).toEqual(['unavailable', 'resolving', 'noPlan'])
      expect(new Set(kinds).size).toBe(3)
    })
  })
})

describe('resolveGroceryView', () => {
  describe('no plan', () => {
    it('resolves to the no-plan state when no plan is active', () => {
      expect(resolveGroceryView(makeQuery(), NO_PLAN_SCOPE)).toEqual({kind: 'noPlan'})
    })

    it('stays on the no-plan state while the query is still loading', () => {
      expect(resolveGroceryView(makeQuery({isLoading: true}), NO_PLAN_SCOPE)).toEqual({kind: 'noPlan'})
    })
  })

  describe('loading', () => {
    it('resolves to the loading state for a plan with no decoded list yet', () => {
      expect(resolveGroceryView(makeQuery({isLoading: true}), PLAN_SCOPE)).toEqual({kind: 'loading'})
    })
  })

  describe('error', () => {
    it('resolves to the error state when the load failed and nothing was decoded', () => {
      expect(resolveGroceryView(makeQuery({isError: true}), PLAN_SCOPE)).toEqual({kind: 'error'})
    })
  })

  describe('empty list', () => {
    it('resolves to the empty-list state for a plan whose list holds no items', () => {
      const list = makeList({totalCount: 0, sections: [], checkedItems: []})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'emptyList', list})
    })

    it('resolves to the empty-list state when a zero count arrives with an aisle the server emptied', () => {
      const list = makeList({totalCount: 0, sections: [makeSection('produce', [])], checkedItems: []})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'emptyList', list})
    })

    it('never claims a plan holds no groceries while its own count says it does', () => {
      const list = makeList({totalCount: 14, sections: [makeSection('produce', [])], checkedItems: []})

      // The empty-list copy is a statement about the plan, so a count that contradicts the rows it arrived
      // with can never produce it: the screen shows its header with nothing under it instead.
      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })

    it('never claims a plan holds no groceries while rows are on the list with nothing checked', () => {
      // The shape an optimistic uncheck-all leaves behind: every row cleared, so checkedCount is 0 and the
      // checked card is empty while the aisles hold the whole list.
      const list = makeList({
        totalCount: 2,
        checkedCount: 0,
        sections: [makeSection('produce', [makeItem()]), makeSection('pantry_other', [makeItem({id: 'item-oil'})])],
        checkedItems: []
      })

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })

    it('never claims a plan holds no groceries while only checked rows remain', () => {
      const list = makeList({totalCount: 1, checkedCount: 1, sections: [], checkedItems: [makeFlaggedItem('item-c')]})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })
  })

  describe('populated list', () => {
    it('resolves to the list state for a plan with stocked items', () => {
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })

    it('resolves to the list state when only checked items remain', () => {
      const list = makeList({checkedCount: 6, sections: [], checkedItems: [makeFlaggedItem('item-chicken')]})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })
  })

  describe('precedence', () => {
    it('keeps a decoded list on screen when a background refetch fails', () => {
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list, isError: true}), PLAN_SCOPE)).toEqual({kind: 'list', list})
    })

    it('keeps no plan, loading, error and empty list as four distinct states', () => {
      const emptyList = makeList({totalCount: 0, sections: [], checkedItems: []})
      const kinds = [
        resolveGroceryView(makeQuery(), NO_PLAN_SCOPE).kind,
        resolveGroceryView(makeQuery({isLoading: true}), PLAN_SCOPE).kind,
        resolveGroceryView(makeQuery({isError: true}), PLAN_SCOPE).kind,
        resolveGroceryView(makeQuery({data: emptyList}), PLAN_SCOPE).kind
      ]

      expect(kinds).toEqual(['noPlan', 'loading', 'error', 'emptyList'])
      expect(new Set(kinds).size).toBe(4)
    })
  })

  describe('plan scope', () => {
    it('shows the retry card, not 14c, when the current-plan lookup itself failed', () => {
      expect(resolveGroceryView(makeQuery(), UNAVAILABLE_SCOPE)).toEqual({kind: 'error'})
    })

    it('shows the skeleton while the plan to shop is still being resolved', () => {
      expect(resolveGroceryView(makeQuery(), RESOLVING_SCOPE)).toEqual({kind: 'loading'})
    })

    it('reads the list of whichever plan is in scope', () => {
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list}), makeScope(CURRENT_PLAN_ID))).toEqual({kind: 'list', list})
    })

    it('answers from the scope before the list, so a stale cache entry cannot outrank it', () => {
      // The list query is disabled in all three scopes, so any entry still in the cache belongs to a plan this
      // screen is no longer shopping.
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list}), UNAVAILABLE_SCOPE)).toEqual({kind: 'error'})
      expect(resolveGroceryView(makeQuery({data: list}), RESOLVING_SCOPE)).toEqual({kind: 'loading'})
      expect(resolveGroceryView(makeQuery({data: list}), NO_PLAN_SCOPE)).toEqual({kind: 'noPlan'})
    })

    it('keeps a failed current-plan lookup and a decoded absence as two different states', () => {
      const kinds = [
        resolveGroceryView(makeQuery(), UNAVAILABLE_SCOPE).kind,
        resolveGroceryView(makeQuery(), NO_PLAN_SCOPE).kind
      ]

      expect(kinds).toEqual(['error', 'noPlan'])
    })
  })
})

describe('isGroceryPlanStateRefusal', () => {
  it.each([API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive])('recognises a confirmed %s', code => {
    expect(isGroceryPlanStateRefusal(apiError(409, code))).toBe(true)
  })

  it('rejects a 5xx that merely echoes a plan-state code, because nothing described the outcome', () => {
    expect(isGroceryPlanStateRefusal(ECHOED_PLAN_CODE_ERROR)).toBe(false)
  })

  it('rejects a confirmed refusal that says nothing about the plan state', () => {
    expect(isGroceryPlanStateRefusal(apiError(409, API_ERROR_CODES.idempotencyConflict))).toBe(false)
    expect(isGroceryPlanStateRefusal(apiError(404, 'Grocery item not found'))).toBe(false)
  })

  it('rejects a network failure, an undecodable body and no error at all', () => {
    expect(isGroceryPlanStateRefusal(NETWORK_ERROR)).toBe(false)
    expect(isGroceryPlanStateRefusal(UNDECODABLE_ERROR)).toBe(false)
    expect(isGroceryPlanStateRefusal(null)).toBe(false)
    expect(isGroceryPlanStateRefusal(undefined)).toBe(false)
  })
})

describe('classifyGroceryWriteFailure', () => {
  it.each([API_ERROR_CODES.planNotActive, API_ERROR_CODES.stalePlan])(
    'gives a confirmed %s the stale-plan copy and a current-plan re-read',
    code => {
      expect(classifyGroceryWriteFailure(apiError(409, code))).toEqual({
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        refetchCurrentPlan: true,
        unpinStalePlan: true
      })
    }
  )

  it('keeps a 5xx echoing a plan-state code generic, with no plan re-read', () => {
    expect(classifyGroceryWriteFailure(ECHOED_PLAN_CODE_ERROR)).toEqual({
      toast: TOAST_GENERIC_ERROR,
      refetchCurrentPlan: false,
      unpinStalePlan: false
    })
  })

  it('keeps a network failure and an undecodable body generic', () => {
    expect(classifyGroceryWriteFailure(NETWORK_ERROR)).toEqual({
      toast: TOAST_GENERIC_ERROR,
      refetchCurrentPlan: false,
      unpinStalePlan: false
    })
    expect(classifyGroceryWriteFailure(UNDECODABLE_ERROR)).toEqual({
      toast: TOAST_GENERIC_ERROR,
      refetchCurrentPlan: false,
      unpinStalePlan: false
    })
  })

  it('keeps every other confirmed refusal generic', () => {
    expect(classifyGroceryWriteFailure(apiError(409, API_ERROR_CODES.idempotencyConflict))).toEqual({
      toast: TOAST_GENERIC_ERROR,
      refetchCurrentPlan: false,
      unpinStalePlan: false
    })
    expect(classifyGroceryWriteFailure(apiError(404, 'Grocery item not found'))).toEqual({
      toast: TOAST_GENERIC_ERROR,
      refetchCurrentPlan: false,
      unpinStalePlan: false
    })
  })

  // Dropping the pin is what stops the shopper repeating a write the plan can never accept: a refusal is about
  // the plan, so every other row on this list would be refused the same way, and the re-read alone cannot move
  // a route-pinned screen off it.
  it('drops the plan pin on a confirmed refusal, and on nothing else', () => {
    const refusals: unknown[] = [apiError(409, API_ERROR_CODES.stalePlan), apiError(409, API_ERROR_CODES.planNotActive)]
    const others: unknown[] = [
      ECHOED_PLAN_CODE_ERROR,
      NETWORK_ERROR,
      UNDECODABLE_ERROR,
      apiError(409, API_ERROR_CODES.idempotencyConflict),
      null
    ]

    refusals.forEach(error => {
      expect(classifyGroceryWriteFailure(error).unpinStalePlan).toBe(true)
    })

    others.forEach(error => {
      expect(classifyGroceryWriteFailure(error).unpinStalePlan).toBe(false)
    })
  })

  it('always says something, so no rejection passes without a report', () => {
    const failures: unknown[] = [
      apiError(409, API_ERROR_CODES.stalePlan),
      ECHOED_PLAN_CODE_ERROR,
      NETWORK_ERROR,
      UNDECODABLE_ERROR,
      null
    ]

    failures.forEach(error => {
      expect(classifyGroceryWriteFailure(error).toast.length).toBeGreaterThan(0)
    })
  })
})

describe('groceryReadRecovery', () => {
  it.each([API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive])(
    'gives a first confirmed %s the stale-plan copy and a current-plan re-read',
    code => {
      expect(groceryReadRecovery({error: apiError(409, code), hasAnnounced: false})).toEqual({
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        refetchCurrentPlan: true,
        isPlanStateFailure: true,
        unpinStalePlan: true
      })
    }
  )

  it('states it once: an already-announced failure raises no second toast and no second refetch', () => {
    expect(groceryReadRecovery({error: apiError(409, API_ERROR_CODES.stalePlan), hasAnnounced: true})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: true,
      unpinStalePlan: false
    })
  })

  it('leaves a network or undecodable failure to the inline retry card, with or without the guard', () => {
    const generic: unknown[] = [NETWORK_ERROR, ECHOED_PLAN_CODE_ERROR, UNDECODABLE_ERROR, apiError(502)]

    generic.forEach(error => {
      ;[false, true].forEach(hasAnnounced => {
        expect(groceryReadRecovery({error, hasAnnounced})).toEqual({
          toast: null,
          refetchCurrentPlan: false,
          isPlanStateFailure: false,
          unpinStalePlan: false
        })
      })
    })
  })

  // A list the plan will not answer for is not a list to retry, so the read failure drops the pin exactly as a
  // refused write does — once, on the first classification, and never for a failure a retry could resolve.
  it('drops the plan pin once, and only for a confirmed plan-state read failure', () => {
    expect(
      groceryReadRecovery({error: apiError(409, API_ERROR_CODES.planNotActive), hasAnnounced: false}).unpinStalePlan
    ).toBe(true)
    expect(
      groceryReadRecovery({error: apiError(409, API_ERROR_CODES.planNotActive), hasAnnounced: true}).unpinStalePlan
    ).toBe(false)
    expect(groceryReadRecovery({error: NETWORK_ERROR, hasAnnounced: false}).unpinStalePlan).toBe(false)
    expect(groceryReadRecovery({error: ECHOED_PLAN_CODE_ERROR, hasAnnounced: false}).unpinStalePlan).toBe(false)
  })

  it('does nothing for a read that has not failed', () => {
    expect(groceryReadRecovery({error: null, hasAnnounced: false})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: false,
      unpinStalePlan: false
    })
    expect(groceryReadRecovery({error: undefined, hasAnnounced: false})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: false,
      unpinStalePlan: false
    })
  })
})

describe('groceryRowVariant', () => {
  it('maps an unchecked row to the unchecked variant', () => {
    expect(groceryRowVariant(makeItem())).toBe('unchecked')
  })

  it('maps a checked row with no flag to the muted variant', () => {
    expect(groceryRowVariant(makeItem({isChecked: true}))).toBe('checkedMuted')
  })

  it('maps a checked row carrying an increase flag to the flagged variant', () => {
    expect(groceryRowVariant(makeItem({isChecked: true, flag: INCREASE_FLAG}))).toBe('flagged')
  })

  it('keeps a checked row whose amount went down muted, with no flag and no banner', () => {
    const decreased = makeItem({isChecked: true, flag: null, displayText: '1.8 lb'})

    expect(groceryRowVariant(decreased)).toBe('checkedMuted')
    expect(flaggedItemNames([decreased])).toEqual([])
    expect(groceryBanner(null, [])).toBeNull()
  })

  it('maps an unchecked row to the unchecked variant even when it carries a flag', () => {
    expect(groceryRowVariant(makeItem({flag: INCREASE_FLAG}))).toBe('unchecked')
  })
})

describe('shouldShowUncheckAll', () => {
  it('hides the action while nothing is checked', () => {
    expect(shouldShowUncheckAll(0)).toBe(false)
  })

  it('shows the action as soon as one item is checked', () => {
    expect(shouldShowUncheckAll(1)).toBe(true)
  })

  it('shows the action for several checked items', () => {
    expect(shouldShowUncheckAll(6)).toBe(true)
  })
})

describe('UNCHECK_ALL_HIT_SLOP', () => {
  it('reaches the 44px target from hit slop alone, over the bare 13px label', () => {
    expect(UNCHECK_ALL_SLOP_TOP + FontSize.LABEL + UNCHECK_ALL_SLOP_BOTTOM).toBeGreaterThanOrEqual(Sizes.TOUCH_TARGET)
  })

  it('stays inside the header row, whose hit rect would otherwise clip the slop', () => {
    expect(UNCHECK_ALL_SLOP_TOP).toBeLessThanOrEqual(HEADER_ROW_SLACK_V)
    expect(UNCHECK_ALL_SLOP_BOTTOM).toBeLessThanOrEqual(HEADER_ROW_SLACK_V)
  })

  it('leaves the horizontal slop the row already had', () => {
    expect(UNCHECK_ALL_HIT_SLOP.left).toBe(Spacing.SMALL)
    expect(UNCHECK_ALL_HIT_SLOP.right).toBe(Spacing.SMALL)
  })
})

describe('groceryEyebrow', () => {
  it('shows the plan range in green before anything is checked', () => {
    const view = resolveGroceryView(makeQuery({data: makeList({checkedCount: 0})}), PLAN_SCOPE)

    expect(groceryEyebrow(view)).toEqual({text: PLAN_RANGE_TEXT, tone: 'green'})
  })

  it('keeps the active-plan green once items are checked and changes only the text', () => {
    const list = makeList({totalCount: 14, checkedCount: 6})
    const view = resolveGroceryView(makeQuery({data: list}), PLAN_SCOPE)

    expect(groceryEyebrow(view)).toEqual({text: CHECKED_PROGRESS_TEXT, tone: 'green'})
  })

  it('reserves the muted tone for the no-plan state, so the tone follows the plan and not the text', () => {
    const beforeChecking = resolveGroceryView(makeQuery({data: makeList({checkedCount: 0})}), PLAN_SCOPE)
    const whileChecking = resolveGroceryView(makeQuery({data: makeList({totalCount: 14, checkedCount: 6})}), PLAN_SCOPE)
    const withoutPlan = resolveGroceryView(makeQuery(), NO_PLAN_SCOPE)

    expect(groceryEyebrow(beforeChecking).tone).toBe('green')
    expect(groceryEyebrow(whileChecking).tone).toBe('green')
    expect(groceryEyebrow(withoutPlan).tone).toBe('muted')
  })

  it('shows the no-plan eyebrow in muted when no plan is active', () => {
    const view = resolveGroceryView(makeQuery(), NO_PLAN_SCOPE)

    expect(groceryEyebrow(view)).toEqual({text: GROCERY_NO_PLAN_EYEBROW, tone: 'muted'})
  })

  it('renders no half-built range for the loading and error states', () => {
    const loading = groceryEyebrow(resolveGroceryView(makeQuery({isLoading: true}), PLAN_SCOPE))
    const failed = groceryEyebrow(resolveGroceryView(makeQuery({isError: true}), PLAN_SCOPE))

    expect(loading).toEqual({text: '', tone: 'muted'})
    expect(failed).toEqual({text: '', tone: 'muted'})
    expect(loading.text).not.toContain('undefined')
    expect(loading.text).not.toContain('NaN')
    expect(failed.text).not.toContain('undefined')
    expect(failed.text).not.toContain('NaN')
  })

  it('keeps the plan range on an empty list, which is not the no-plan state', () => {
    const emptyList = makeList({totalCount: 0, sections: [], checkedItems: []})
    const view = resolveGroceryView(makeQuery({data: emptyList}), PLAN_SCOPE)

    expect(groceryEyebrow(view)).toEqual({text: PLAN_RANGE_TEXT, tone: 'green'})
    expect(groceryEyebrow(view).text).not.toBe(GROCERY_NO_PLAN_EYEBROW)
  })
})

describe('flaggedItemNames', () => {
  it('names nothing for an empty list', () => {
    expect(flaggedItemNames([])).toEqual([])
  })

  it('names nothing when no row carries a flag', () => {
    expect(flaggedItemNames([makeItem(), makeItem({id: 'item-avocado', isChecked: true})])).toEqual([])
  })

  it('names a single flagged row among unflagged ones', () => {
    const items = [makeItem(), makeFlaggedItem('item-chicken'), makeItem({id: 'item-lime'})]

    expect(flaggedItemNames(items)).toEqual([FLAGGED_ITEM_NAME])
  })

  it('names every flagged row, in the order the Checked card draws them', () => {
    const items = [
      makeFlaggedItem('item-chicken'),
      makeFlaggedItem('item-salmon', 'Salmon fillet'),
      makeFlaggedItem('item-feta', 'Feta'),
      makeItem()
    ]

    expect(flaggedItemNames(items)).toEqual([FLAGGED_ITEM_NAME, 'Salmon fillet', 'Feta'])
  })

  // A flag on a row with no tick draws as a plain aisle row -- orderCheckedItems never promotes it -- so it
  // may not reach the banner either: naming it would point the sentence at a row showing no flag at all.
  it('ignores a flag on a row that is not checked', () => {
    const items = [
      makeItem({id: 'item-avocado', name: 'Avocado', flag: INCREASE_FLAG}),
      makeFlaggedItem('item-chicken')
    ]

    expect(flaggedItemNames(items)).toEqual([FLAGGED_ITEM_NAME])
  })

  it('keeps a blank name rather than dropping the flagged row it belongs to', () => {
    expect(flaggedItemNames([makeFlaggedItem('item-unnamed', '')])).toEqual([''])
    expect(flaggedItemNames([makeFlaggedItem('item-unnamed', '')])).toHaveLength(1)
  })

  it('does not mutate the list it was given', () => {
    const items = [makeFlaggedItem('item-chicken'), makeItem()]
    const snapshot = JSON.parse(JSON.stringify(items))

    flaggedItemNames(items)

    expect(items).toEqual(snapshot)
  })
})

describe('groceryBanner', () => {
  describe('no banner', () => {
    it('returns null when the list carries no banner', () => {
      expect(groceryBanner(null, [])).toBeNull()
    })

    it('returns null when flags exist but no banner was sent', () => {
      expect(groceryBanner(null, [FLAGGED_ITEM_NAME, 'Salmon fillet', 'Feta'])).toBeNull()
    })
  })

  describe('updated after swap', () => {
    it('renders the success tick banner naming the swapped slot', () => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: 'lunch'}, [])

      expect(content?.tone).toBe('success')
      expect(content?.glyph).toBe('tick')
      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEMPLATE.replace('{slot}', 'lunch'))
      expect(content?.body).toContain('lunch')
    })

    it('states the swap without inventing a slot when the banner names none', () => {
      const content = groceryBanner({code: 'updated_after_swap'}, [])

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(content?.body).not.toContain('undefined')
      expect(content?.body).not.toContain('{')
    })

    it('states the swap without a slot for a slot code it does not know', () => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: UNKNOWN_MEAL_SLOT}, [])

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(content?.body).not.toContain('undefined')
    })

    it.each(PROTOTYPE_KEYS)('states the swap without a slot for the inherited slot name %s', key => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: key}, [])

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(typeof content?.body).toBe('string')
      expect(content?.body).not.toContain('function')
      expect(content?.body).not.toContain('[object')
    })

    it('gives an inherited slot name the same banner as a slot code it does not know', () => {
      const inherited = groceryBanner({code: 'updated_after_swap', mealSlot: INHERITED_KEY}, [])
      const unknown = groceryBanner({code: 'updated_after_swap', mealSlot: UNKNOWN_MEAL_SLOT}, [])

      expect(inherited).toEqual(unknown)
    })
  })

  describe('amount increased', () => {
    it('names the one flagged row in the singular banner', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]}, [FLAGGED_ITEM_NAME])

      expect(content?.tone).toBe('error')
      expect(content?.glyph).toBe('warning')
      expect(content?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(content?.body).toBe(GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE.replace('{name}', FLAGGED_ITEM_NAME))
      expect(content?.body).toContain(FLAGGED_ITEM_NAME)
    })

    it('counts the flagged rows in the plural banner', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]}, [
        FLAGGED_ITEM_NAME,
        'Spinach',
        'Feta'
      ])

      expect(content?.tone).toBe('error')
      expect(content?.glyph).toBe('warning')
      expect(content?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '3'))
      expect(content?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '3'))
      expect(content?.title).toContain('3')
      expect(content?.body).toContain('3')
    })

    // The response names the row it flagged when it answered, and an untick since then may have cleared that
    // very row. The rendered rows decide, so the sentence can only name a row still drawing a flag -- and the
    // row that is actually flagged can never go unnamed while a cleared one is named in its place.
    it('names the surviving flagged row rather than the one the response named', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: ['Avocado']}, ['Bell pepper, red'])

      expect(content?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(content?.body).toContain('Bell pepper, red')
      expect(content?.body).not.toContain('Avocado')
    })

    it('reads the rows alone, so stale response names change nothing', () => {
      const fromRows = groceryBanner({code: 'amount_increased'}, [FLAGGED_ITEM_NAME])
      const withStaleNames = groceryBanner({code: 'amount_increased', itemNames: ['Avocado', 'Lime']}, [
        FLAGGED_ITEM_NAME
      ])

      expect(withStaleNames).toEqual(fromRows)
    })

    // Unticking the last flagged row clears its flag and leaves the response's banner untouched until the
    // settle refetch lands, so the sentence has to withdraw: there is no flagged row "below", and the Checked
    // card it points at has gone with it.
    it('withdraws the banner once no flagged row survives', () => {
      expect(groceryBanner({code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]}, [])).toBeNull()
      expect(groceryBanner({code: 'amount_increased', itemNames: []}, [])).toBeNull()
      expect(groceryBanner({code: 'amount_increased'}, [])).toBeNull()
    })

    // Grammar follows the count, never the availability of a name, so one nameless flag stays singular
    // instead of reading "1 amounts went up after your swaps" / "1 items are flagged below".
    it('keeps singular grammar for one flagged row that carries no name', () => {
      const content = groceryBanner({code: 'amount_increased'}, [''])

      expect(content?.tone).toBe('error')
      expect(content?.glyph).toBe('warning')
      expect(content?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(content?.body).toBe(GROCERY_AMOUNT_INCREASED_BODY_UNNAMED)
      expect(content?.title).not.toContain('1 amounts')
      expect(content?.body).not.toContain('1 items')
      expect(content?.body).not.toContain('undefined')
      expect(content?.body).not.toContain('{')
      expect(content?.body).not.toContain('  ')
      expect(content?.body).not.toMatch(/^\s/)
    })

    it('treats a whitespace-only name as no name rather than rendering a gap', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: ['   ']}, ['   '])

      expect(content?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(content?.body).toBe(GROCERY_AMOUNT_INCREASED_BODY_UNNAMED)
      expect(content?.body).not.toContain('   ')
    })

    it('still pluralises when several flagged rows carry no names', () => {
      const content = groceryBanner({code: 'amount_increased'}, ['', ''])

      expect(content?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '2'))
      expect(content?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '2'))
    })

    it('never renders a count the flagged rows do not support', () => {
      const counts = [0, 1, 2, 3, 14]

      counts.forEach(count => {
        const names = Array.from({length: count}, (_unused, index) => `Item ${index}`)
        const content = groceryBanner({code: 'amount_increased', itemNames: ['Avocado']}, names)

        if (count === 0) {
          expect(content).toBeNull()

          return
        }

        const rendered = `${content?.title ?? ''} ${content?.body ?? ''}`

        expect(rendered).not.toContain('0 amounts')
        expect(rendered).not.toContain('1 amounts')
        expect(rendered).not.toContain('1 items')
        expect(rendered).not.toContain('Avocado')
        expect(rendered).not.toContain('undefined')
        expect(rendered).not.toContain('{')

        if (count > 1) {
          expect(content?.title).toContain(String(count))
          expect(content?.body).toContain(String(count))
        }
      })
    })
  })
})

describe('orderGrocerySections', () => {
  describe('ordering', () => {
    it('returns the aisles in store order with pantry and other last', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('grains_bread', [makeItem({id: 'item-rice'})]),
        makeSection('protein', [makeItem({id: 'item-chicken'})]),
        makeSection('dairy_alternatives', [makeItem({id: 'item-yogurt'})]),
        makeSection('produce', [makeItem()])
      ]

      expect(orderGrocerySections(sections).map(section => section.category)).toEqual([
        'produce',
        'protein',
        'dairy_alternatives',
        'grains_bread',
        'pantry_other'
      ])
    })

    it('closes the list in order with no gap when a category is absent', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('protein', [makeItem({id: 'item-chicken'})]),
        makeSection('grains_bread', [makeItem({id: 'item-rice'})]),
        makeSection('produce', [makeItem()])
      ]

      expect(orderGrocerySections(sections).map(section => section.category)).toEqual([
        'produce',
        'protein',
        'grains_bread',
        'pantry_other'
      ])
    })

    it('sorts an unrecognised category after the named aisles but before pantry and other', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeUnknownSection(UNKNOWN_CATEGORY, [makeItem({id: 'item-peas'})]),
        makeSection('produce', [makeItem()]),
        makeSection('grains_bread', [makeItem({id: 'item-rice'})])
      ]

      expect(orderGrocerySections(sections).map(section => section.category)).toEqual([
        'produce',
        'grains_bread',
        UNKNOWN_CATEGORY,
        'pantry_other'
      ])
    })
  })

  // The converter files an aisle code this version does not know under the catch-all, which the response
  // also sends in its own right, so two sections claiming one category is the ordinary consequence of a
  // backend released ahead of the client (0.7.5). buildGroceryViewModel keys its blocks by category, so the
  // sections have to leave here folded or the list is handed two cells under one key.
  describe('sections sharing one category', () => {
    it('folds them into the section that claimed the category first', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('produce', [makeItem()]),
        makeSection('pantry_other', [makeItem({id: 'item-peas'})])
      ]
      const ordered = orderGrocerySections(sections)

      expect(ordered.map(section => section.category)).toEqual(['produce', 'pantry_other'])
      expect(ordered[1].items.map(item => item.id)).toEqual(['item-oil', 'item-peas'])
    })

    it('lists no category twice, so the caller can key a list off it', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('pantry_other', [makeItem({id: 'item-peas'})]),
        makeSection('produce', [makeItem()]),
        makeSection('produce', [makeItem({id: 'item-avocado'})])
      ]
      const categories = orderGrocerySections(sections).map(section => section.category)

      expect(categories).toEqual(['produce', 'pantry_other'])
      expect(new Set(categories).size).toBe(categories.length)
    })

    it('folds onto the surviving section when the first was emptied by its checked rows', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil', isChecked: true})]),
        makeSection('pantry_other', [makeItem({id: 'item-peas'})])
      ]
      const ordered = orderGrocerySections(sections)

      expect(ordered).toHaveLength(1)
      expect(ordered[0].items.map(item => item.id)).toEqual(['item-peas'])
    })

    it('drops the category outright when every one of its sections is checked through', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil', isChecked: true})]),
        makeSection('pantry_other', [makeItem({id: 'item-peas', isChecked: true})])
      ]

      expect(orderGrocerySections(sections)).toEqual([])
    })

    it('keeps distinct categories apart, an unknown code included', () => {
      const sections = [
        makeUnknownSection(UNKNOWN_CATEGORY, [makeItem({id: 'item-peas'})]),
        makeSection('pantry_other', [makeItem({id: 'item-oil'})])
      ]
      const ordered = orderGrocerySections(sections)

      expect(ordered.map(section => section.category)).toEqual([UNKNOWN_CATEGORY, 'pantry_other'])
      expect(ordered.map(section => section.items.length)).toEqual([1, 1])
    })

    it('does not mutate the sections or the item arrays it folded', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('pantry_other', [makeItem({id: 'item-peas'})])
      ]
      const snapshot = JSON.parse(JSON.stringify(sections))

      orderGrocerySections(sections)

      expect(sections).toEqual(snapshot)
      expect(sections[0].items).toHaveLength(1)
    })
  })

  describe('checked items', () => {
    it('drops checked rows so they render in the checked block alone', () => {
      const sections = [makeSection('produce', [makeItem({isChecked: true}), makeItem({id: 'item-avocado'})])]
      const [produce] = orderGrocerySections(sections)

      expect(produce.items.map(item => item.id)).toEqual(['item-avocado'])
    })

    it('drops an aisle whose every row is checked so no bare header renders', () => {
      const sections = [
        makeSection('produce', [makeItem({isChecked: true})]),
        makeSection('protein', [makeItem({id: 'item-chicken'})])
      ]

      expect(orderGrocerySections(sections).map(section => section.category)).toEqual(['protein'])
    })

    it('returns no sections when every row is checked', () => {
      const sections = [makeSection('produce', [makeItem({isChecked: true})])]

      expect(orderGrocerySections(sections)).toEqual([])
    })
  })

  describe('purity', () => {
    it('leaves the input sections and their item arrays untouched', () => {
      const sections = [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('produce', [makeItem({isChecked: true}), makeItem({id: 'item-avocado'})])
      ]
      const snapshot = JSON.parse(JSON.stringify(sections))
      const ordered = orderGrocerySections(sections)

      expect(sections).toEqual(snapshot)
      expect(ordered).not.toBe(sections)
    })
  })
})

describe('orderCheckedItems', () => {
  describe('ordering', () => {
    it('puts the flagged row first, as 37:260 draws it', () => {
      const items = [
        makeItem({id: 'item-spinach', isChecked: true}),
        makeItem({id: 'item-broccoli', isChecked: true}),
        makeFlaggedItem('item-chicken')
      ]

      expect(orderCheckedItems(items).map(item => item.id)).toEqual(['item-chicken', 'item-spinach', 'item-broccoli'])
    })

    it('keeps the response order within each group so rows stay stable', () => {
      const items = [
        makeItem({id: 'item-spinach', isChecked: true}),
        makeFlaggedItem('item-chicken'),
        makeItem({id: 'item-broccoli', isChecked: true}),
        makeFlaggedItem('item-salmon'),
        makeItem({id: 'item-rice', isChecked: true})
      ]

      expect(orderCheckedItems(items).map(item => item.id)).toEqual([
        'item-chicken',
        'item-salmon',
        'item-spinach',
        'item-broccoli',
        'item-rice'
      ])
    })

    it('leaves an all-muted block untouched, so a decrease never reorders the list', () => {
      const items = [
        makeItem({id: 'item-spinach', isChecked: true}),
        makeItem({id: 'item-oil', isChecked: true, displayText: '4 tbsp'})
      ]

      expect(orderCheckedItems(items).map(item => item.id)).toEqual(['item-spinach', 'item-oil'])
    })
  })

  describe('edge cases', () => {
    it('returns an empty block for an empty list', () => {
      expect(orderCheckedItems([])).toEqual([])
    })

    it('never promotes an unchecked row, because only a checked row can carry the flagged treatment', () => {
      const items = [makeItem({id: 'item-avocado', flag: INCREASE_FLAG}), makeFlaggedItem('item-chicken')]

      expect(orderCheckedItems(items).map(item => item.id)).toEqual(['item-chicken', 'item-avocado'])
    })

    it('does not mutate the list it was given', () => {
      const items = [makeItem({id: 'item-spinach', isChecked: true}), makeFlaggedItem('item-chicken')]

      orderCheckedItems(items)

      expect(items.map(item => item.id)).toEqual(['item-spinach', 'item-chicken'])
    })
  })
})

describe('groceryCategoryLabel', () => {
  it('labels each known aisle with its copy constant', () => {
    const codes = ['produce', 'protein', 'dairy_alternatives', 'grains_bread', 'pantry_other']

    expect(codes.map(groceryCategoryLabel)).toEqual([
      GROCERY_CATEGORY_LABELS.produce,
      GROCERY_CATEGORY_LABELS.protein,
      GROCERY_CATEGORY_LABELS.dairy_alternatives,
      GROCERY_CATEGORY_LABELS.grains_bread,
      GROCERY_CATEGORY_LABELS.pantry_other
    ])
  })

  it('falls back to the closing aisle label for a category it does not know', () => {
    expect(groceryCategoryLabel(UNKNOWN_CATEGORY)).toBe(GROCERY_CATEGORY_LABELS.pantry_other)
  })

  it('falls back to the closing aisle label for an empty category code', () => {
    expect(groceryCategoryLabel('')).toBe(GROCERY_CATEGORY_LABELS.pantry_other)
  })

  it('gives an unknown category the same label as the closing aisle', () => {
    expect(groceryCategoryLabel(UNKNOWN_CATEGORY)).toBe(groceryCategoryLabel('pantry_other'))
  })

  it.each(PROTOTYPE_KEYS)('falls back to the closing aisle label for the inherited category name %s', key => {
    expect(groceryCategoryLabel(key)).toBe(GROCERY_CATEGORY_LABELS.pantry_other)
  })

  it('labels an inherited category name with copy rather than the member it inherits', () => {
    const label = groceryCategoryLabel(INHERITED_KEY)

    expect(typeof label).toBe('string')
    expect(label).toBe(groceryCategoryLabel(UNKNOWN_CATEGORY))
  })
})

describe('buildGroceryViewModel', () => {
  const stockedList = (overrides: Partial<GroceryList> = {}): GroceryList =>
    makeList({
      sections: [
        makeSection('pantry_other', [makeItem({id: 'item-oil'})]),
        makeSection('produce', [makeItem()]),
        makeSection('protein', [makeItem({id: 'item-chicken'})])
      ],
      ...overrides
    })

  describe('blocks', () => {
    it('orders the aisle blocks in store order and marks only the first', () => {
      const {blocks} = buildGroceryViewModel(stockedList())

      expect(blocks.map(block => block.key)).toEqual(['category:produce', 'category:protein', 'category:pantry_other'])
      expect(blocks.map(block => (block.kind === 'category' ? block.isFirst : null))).toEqual([true, false, false])
    })

    it('labels every aisle block with its own copy constant', () => {
      const {blocks} = buildGroceryViewModel(stockedList())

      expect(blocks.map(block => (block.kind === 'category' ? block.label : null))).toEqual([
        GROCERY_CATEGORY_LABELS.produce,
        GROCERY_CATEGORY_LABELS.protein,
        GROCERY_CATEGORY_LABELS.pantry_other
      ])
    })

    it('drops an aisle whose every row is checked, so no bare header renders', () => {
      const {blocks} = buildGroceryViewModel(
        stockedList({
          sections: [makeSection('produce', [makeItem({isChecked: true})]), makeSection('protein', [makeItem()])],
          checkedCount: 1,
          checkedItems: [makeItem({isChecked: true})]
        })
      )

      expect(blocks.map(block => block.key)).toEqual(['category:protein', 'checked'])
    })

    it('carries no Checked block while nothing is checked', () => {
      const {blocks} = buildGroceryViewModel(stockedList())

      expect(blocks.every(block => block.kind === 'category')).toBe(true)
    })

    it('closes the list with the Checked block, titled from the server count', () => {
      const {blocks} = buildGroceryViewModel(
        stockedList({checkedCount: 6, checkedItems: [makeItem({id: 'item-feta', isChecked: true})]})
      )
      const [checked] = blocks.filter(block => block.kind === 'checked')

      expect(blocks[blocks.length - 1].key).toBe('checked')
      expect(checked.kind === 'checked' ? checked.title : null).toBe(
        GROCERY_CHECKED_HEADER_TEMPLATE.replace('{n}', '6')
      )
    })

    it('puts the flagged row first inside the Checked block, as 37:260 draws it', () => {
      const {blocks} = buildGroceryViewModel(
        stockedList({
          checkedCount: 2,
          checkedItems: [makeItem({id: 'item-spinach', isChecked: true}), makeFlaggedItem('item-chicken')]
        })
      )
      const [checked] = blocks.filter(block => block.kind === 'checked')

      expect(checked.items.map(item => item.id)).toEqual(['item-chicken', 'item-spinach'])
    })

    it('never repeats a block key, so the list can key off it', () => {
      const {blocks} = buildGroceryViewModel(
        stockedList({checkedCount: 1, checkedItems: [makeFlaggedItem('item-chicken')]})
      )

      expect(new Set(blocks.map(block => block.key)).size).toBe(blocks.length)
    })

    // Two sections claiming one category arrive whenever the response carries both an aisle code this
    // version does not know and the catch-all it is filed under. Left apart they would hand the FlatList two
    // cells keyed 'category:pantry_other' -- a duplicate-key error, two identical 'Pantry & other' headings,
    // and recycled cells landing under the wrong one.
    it('folds two sections claiming one category into a single keyed block', () => {
      const {blocks} = buildGroceryViewModel(
        makeList({
          sections: [
            makeSection('pantry_other', [makeItem({id: 'item-oil', name: 'Olive oil'})]),
            makeSection('produce', [makeItem()]),
            makeSection('pantry_other', [makeItem({id: 'item-peas', name: 'Frozen peas'})])
          ]
        })
      )
      const pantry = blocks.filter(block => block.key === 'category:pantry_other')

      expect(pantry).toHaveLength(1)
      expect(new Set(blocks.map(block => block.key)).size).toBe(blocks.length)
      expect(pantry[0].items.map(item => item.id)).toEqual(['item-oil', 'item-peas'])
      expect(
        blocks.filter(block => block.kind === 'category' && block.label === GROCERY_CATEGORY_LABELS.pantry_other)
      ).toHaveLength(1)
    })
  })

  describe('banner and flags', () => {
    it('counts the flagged checked rows', () => {
      const model = buildGroceryViewModel(
        stockedList({
          checkedCount: 3,
          checkedItems: [
            makeFlaggedItem('item-chicken'),
            makeFlaggedItem('item-salmon'),
            makeItem({id: 'item-feta', isChecked: true})
          ]
        })
      )

      expect(model.flagCount).toBe(2)
    })

    it('pluralises the increase banner by the flag count it counted', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME, 'Salmon']},
          checkedCount: 2,
          checkedItems: [makeFlaggedItem('item-chicken'), makeFlaggedItem('item-salmon')]
        })
      )

      expect(model.banner).toEqual({
        tone: 'error',
        glyph: 'warning',
        title: GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '2'),
        body: GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '2')
      })
    })

    it('names the one increased item in the singular banner', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]},
          checkedCount: 1,
          checkedItems: [makeFlaggedItem('item-chicken')]
        })
      )

      expect(model.banner?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(model.banner?.body).toContain(FLAGGED_ITEM_NAME)
    })

    it('renders no banner when the list carries none', () => {
      expect(buildGroceryViewModel(stockedList()).banner).toBeNull()
      expect(buildGroceryViewModel(stockedList()).flagCount).toBe(0)
    })

    // The rendered Checked card is the naming authority. An untick clears the row's flag and leaves the
    // response's itemNames pointing at it, so reading those names would name a row that is now neither
    // flagged nor checked while the row that is still flagged went unnamed.
    it('names the flagged row the Checked card is drawing, not the one the response named', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: ['Avocado']},
          checkedCount: 1,
          checkedItems: [makeFlaggedItem('item-pepper', 'Bell pepper, red')]
        })
      )

      expect(model.banner?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(model.banner?.body).toContain('Bell pepper, red')
      expect(model.banner?.body).not.toContain('Avocado')
    })

    // The optimistic untick clears the flag and leaves the response's banner untouched until the settle
    // refetch lands, so the model is what has to stop asserting an increase: nothing is flagged, and the
    // Checked card the sentence points at has gone with it.
    it('drops the increase banner once the flags are cleared, response notwithstanding', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]},
          checkedCount: 0,
          checkedItems: []
        })
      )

      expect(model.banner).toBeNull()
      expect(model.flagCount).toBe(0)
      expect(model.blocks.every(block => block.kind === 'category')).toBe(true)
    })

    // Still-checked rows with the flag cleared are the other half of that state: the Checked card remains,
    // but nothing in it is flagged, so the increase sentence still has nothing to point at.
    it('drops the increase banner while rows stay checked but unflagged', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]},
          checkedCount: 2,
          checkedItems: [
            makeItem({id: 'item-chicken', name: FLAGGED_ITEM_NAME, isChecked: true}),
            makeItem({id: 'item-spinach', isChecked: true})
          ]
        })
      )

      expect(model.banner).toBeNull()
      expect(model.flagCount).toBe(0)
      expect(model.blocks.some(block => block.kind === 'checked')).toBe(true)
    })

    it('keeps the swap banner after the last flag is cleared, being a claim about the swap', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'updated_after_swap', mealSlot: 'lunch'},
          checkedCount: 0,
          checkedItems: []
        })
      )

      expect(model.banner?.tone).toBe('success')
      expect(model.banner?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEMPLATE.replace('{slot}', 'lunch'))
    })

    it('pluralises from the rows it counted even when the response named just one', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]},
          checkedCount: 2,
          checkedItems: [makeFlaggedItem('item-chicken'), makeFlaggedItem('item-salmon', 'Salmon fillet')]
        })
      )

      expect(model.flagCount).toBe(2)
      expect(model.banner?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '2'))
      expect(model.banner?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '2'))
    })

    it('states one nameless flagged row in the singular, never as "1 amounts"', () => {
      const model = buildGroceryViewModel(
        stockedList({
          banner: {code: 'amount_increased'},
          checkedCount: 1,
          checkedItems: [makeFlaggedItem('item-unnamed', '')]
        })
      )

      expect(model.flagCount).toBe(1)
      expect(model.banner?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(model.banner?.body).toBe(GROCERY_AMOUNT_INCREASED_BODY_UNNAMED)
      expect(model.banner?.title).not.toContain('1 amounts')
      expect(model.banner?.body).not.toContain('1 items')
    })

    // The count beside the list and the sentence above it read one scan of the same rows, so a flag either
    // shows up in both or in neither.
    it('agrees between the flag count and the banner it rendered', () => {
      const cases: Array<{checkedItems: GroceryItem[]; flagCount: number; hasBanner: boolean}> = [
        {checkedItems: [], flagCount: 0, hasBanner: false},
        {checkedItems: [makeItem({id: 'item-spinach', isChecked: true})], flagCount: 0, hasBanner: false},
        {checkedItems: [makeFlaggedItem('item-chicken')], flagCount: 1, hasBanner: true},
        {
          checkedItems: [makeFlaggedItem('item-chicken'), makeFlaggedItem('item-salmon', 'Salmon fillet')],
          flagCount: 2,
          hasBanner: true
        }
      ]

      cases.forEach(({checkedItems, flagCount, hasBanner}) => {
        const model = buildGroceryViewModel(
          stockedList({
            banner: {code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]},
            checkedCount: checkedItems.length,
            checkedItems
          })
        )

        expect(model.flagCount).toBe(flagCount)
        expect(model.banner !== null).toBe(hasBanner)
      })
    })
  })

  describe('uncheck all', () => {
    it('hides the action while nothing is checked, so 14 draws no dead control', () => {
      expect(buildGroceryViewModel(stockedList()).showsUncheckAll).toBe(false)
    })

    it('shows the action as soon as one row is checked', () => {
      const model = buildGroceryViewModel(
        stockedList({checkedCount: 1, checkedItems: [makeItem({id: 'item-feta', isChecked: true})]})
      )

      expect(model.showsUncheckAll).toBe(true)
    })
  })

  describe('purity', () => {
    it('is a function of the list alone: the same list yields the same model', () => {
      const list = stockedList({checkedCount: 1, checkedItems: [makeFlaggedItem('item-chicken')]})

      expect(buildGroceryViewModel(list)).toEqual(buildGroceryViewModel(list))
    })

    it('leaves the list, its sections and its rows untouched', () => {
      const list = stockedList({
        checkedCount: 2,
        checkedItems: [makeItem({id: 'item-spinach', isChecked: true}), makeFlaggedItem('item-chicken')]
      })
      const snapshot = JSON.parse(JSON.stringify(list))

      buildGroceryViewModel(list)

      expect(list).toEqual(snapshot)
    })
  })

  describe('empty model', () => {
    it('renders nothing at all for the states that hold no list', () => {
      expect(EMPTY_GROCERY_VIEW_MODEL).toEqual({blocks: [], banner: null, showsUncheckAll: false, flagCount: 0})
    })
  })
})

describe('contentColumnWidth', () => {
  it('gives a 335 px column on a 375 px device', () => {
    expect(contentColumnWidth(375)).toBe(335)
  })

  it('gives a 353 px column at the 393 px reference width', () => {
    expect(contentColumnWidth(393)).toBe(353)
  })

  it('caps the column at the 600 px tablet maximum', () => {
    expect(contentColumnWidth(1024)).toBe(560)
  })

  it('stops growing once the window is past the tablet maximum', () => {
    expect(contentColumnWidth(1024)).toBe(contentColumnWidth(2048))
  })

  it('keeps the phone widths the frames are authored at', () => {
    expect([320, 375, 393, 430, 834].map(contentColumnWidth)).toEqual([280, 335, 353, 390, 560])
  })

  describe('widths the gutters exhaust', () => {
    it('collapses to zero rather than a negative width at a zero window', () => {
      expect(contentColumnWidth(0)).toBe(0)
    })

    it('collapses to zero for a negative window', () => {
      expect(contentColumnWidth(-1)).toBe(0)
    })

    it('collapses to zero once the gutters exceed the window', () => {
      expect(contentColumnWidth(2)).toBe(0)
    })

    it('returns zero at the window the gutters exactly consume', () => {
      expect(contentColumnWidth(40)).toBe(0)
    })

    it('returns the one pixel left over just past that window', () => {
      expect(contentColumnWidth(41)).toBe(1)
    })

    it('collapses to zero for a width that is not a number', () => {
      expect(contentColumnWidth(NaN)).toBe(0)
    })

    it('collapses to zero for a negatively infinite width', () => {
      expect(contentColumnWidth(-Infinity)).toBe(0)
    })

    it('caps a positively infinite width at the tablet maximum', () => {
      expect(contentColumnWidth(Infinity)).toBe(560)
    })

    it('is never negative and never non-finite across the whole range', () => {
      const widths = [-Infinity, -1000, -1, 0, 0.5, 2, 39.5, 40, 41, 320, 393, 600, 1024, 2048, Infinity, NaN]

      widths.forEach(width => {
        const column = contentColumnWidth(width)

        expect(Number.isFinite(column)).toBe(true)
        expect(column).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
