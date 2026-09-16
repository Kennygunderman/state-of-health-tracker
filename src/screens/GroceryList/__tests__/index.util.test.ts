import {GroceryCategory, GroceryItem, GroceryItemFlag, GroceryList, GrocerySection} from '@data/models/GroceryList'

import {
  GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNT_INCREASED_TITLE,
  GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
  GROCERY_CATEGORY_LABELS,
  GROCERY_NO_PLAN_EYEBROW,
  GROCERY_UPDATED_AFTER_SWAP_TEMPLATE,
  GROCERY_UPDATED_AFTER_SWAP_TEXT
} from '@constants/strings'

import {
  contentColumnWidth,
  countFlaggedItems,
  groceryBanner,
  groceryCategoryLabel,
  groceryEyebrow,
  GroceryQueryState,
  groceryRowVariant,
  orderCheckedItems,
  orderGrocerySections,
  resolveGroceryView,
  shouldShowUncheckAll
} from '../index.util'

const PLAN_ID = 'plan-7c9f'
const START_DATE = '2026-07-05'
const END_DATE = '2026-07-11'
const PLAN_RANGE_TEXT = 'Jul 5 – Jul 11'
const CHECKED_PROGRESS_TEXT = '6 of 14 checked'
const FLAGGED_ITEM_NAME = 'Chicken breast'
const UNKNOWN_CATEGORY = 'frozen'
const UNKNOWN_MEAL_SLOT = 'brunch'
const INHERITED_KEY = 'toString'

// Names every copy table inherits from Object.prototype: a raw index returns a function (or, for __proto__, an
// object), which is not nullish and so would slip past the unknown-code fallback into rendered copy.
const PROTOTYPE_KEYS = ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']

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

const makeFlaggedItem = (id: string): GroceryItem => makeItem({id, isChecked: true, flag: INCREASE_FLAG})

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

describe('resolveGroceryView', () => {
  describe('no plan', () => {
    it('resolves to the no-plan state when no plan is active', () => {
      expect(resolveGroceryView(makeQuery(), null)).toEqual({kind: 'noPlan'})
    })

    it('stays on the no-plan state while the query is still loading', () => {
      expect(resolveGroceryView(makeQuery({isLoading: true}), null)).toEqual({kind: 'noPlan'})
    })
  })

  describe('loading', () => {
    it('resolves to the loading state for a plan with no decoded list yet', () => {
      expect(resolveGroceryView(makeQuery({isLoading: true}), PLAN_ID)).toEqual({kind: 'loading'})
    })
  })

  describe('error', () => {
    it('resolves to the error state when the load failed and nothing was decoded', () => {
      expect(resolveGroceryView(makeQuery({isError: true}), PLAN_ID)).toEqual({kind: 'error'})
    })
  })

  describe('empty list', () => {
    it('resolves to the empty-list state for a plan whose list holds no items', () => {
      const list = makeList({totalCount: 0, sections: [], checkedItems: []})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'emptyList', list})
    })

    it('resolves to the empty-list state when a zero count arrives with an aisle the server emptied', () => {
      const list = makeList({totalCount: 0, sections: [makeSection('produce', [])], checkedItems: []})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'emptyList', list})
    })

    it('never claims a plan holds no groceries while its own count says it does', () => {
      const list = makeList({totalCount: 14, sections: [makeSection('produce', [])], checkedItems: []})

      // The empty-list copy is a statement about the plan, so a count that contradicts the rows it arrived
      // with can never produce it: the screen shows its header with nothing under it instead.
      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'list', list})
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

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'list', list})
    })

    it('never claims a plan holds no groceries while only checked rows remain', () => {
      const list = makeList({totalCount: 1, checkedCount: 1, sections: [], checkedItems: [makeFlaggedItem('item-c')]})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'list', list})
    })
  })

  describe('populated list', () => {
    it('resolves to the list state for a plan with stocked items', () => {
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'list', list})
    })

    it('resolves to the list state when only checked items remain', () => {
      const list = makeList({checkedCount: 6, sections: [], checkedItems: [makeFlaggedItem('item-chicken')]})

      expect(resolveGroceryView(makeQuery({data: list}), PLAN_ID)).toEqual({kind: 'list', list})
    })
  })

  describe('precedence', () => {
    it('keeps a decoded list on screen when a background refetch fails', () => {
      const list = makeList()

      expect(resolveGroceryView(makeQuery({data: list, isError: true}), PLAN_ID)).toEqual({kind: 'list', list})
    })

    it('keeps no plan, loading, error and empty list as four distinct states', () => {
      const emptyList = makeList({totalCount: 0, sections: [], checkedItems: []})
      const kinds = [
        resolveGroceryView(makeQuery(), null).kind,
        resolveGroceryView(makeQuery({isLoading: true}), PLAN_ID).kind,
        resolveGroceryView(makeQuery({isError: true}), PLAN_ID).kind,
        resolveGroceryView(makeQuery({data: emptyList}), PLAN_ID).kind
      ]

      expect(kinds).toEqual(['noPlan', 'loading', 'error', 'emptyList'])
      expect(new Set(kinds).size).toBe(4)
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
    expect(countFlaggedItems([decreased])).toBe(0)
    expect(groceryBanner(null, 0)).toBeNull()
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

describe('groceryEyebrow', () => {
  it('shows the plan range in green before anything is checked', () => {
    const view = resolveGroceryView(makeQuery({data: makeList({checkedCount: 0})}), PLAN_ID)

    expect(groceryEyebrow(view)).toEqual({text: PLAN_RANGE_TEXT, tone: 'green'})
  })

  it('keeps the active-plan green once items are checked and changes only the text', () => {
    const list = makeList({totalCount: 14, checkedCount: 6})
    const view = resolveGroceryView(makeQuery({data: list}), PLAN_ID)

    expect(groceryEyebrow(view)).toEqual({text: CHECKED_PROGRESS_TEXT, tone: 'green'})
  })

  it('reserves the muted tone for the no-plan state, so the tone follows the plan and not the text', () => {
    const beforeChecking = resolveGroceryView(makeQuery({data: makeList({checkedCount: 0})}), PLAN_ID)
    const whileChecking = resolveGroceryView(makeQuery({data: makeList({totalCount: 14, checkedCount: 6})}), PLAN_ID)
    const withoutPlan = resolveGroceryView(makeQuery(), null)

    expect(groceryEyebrow(beforeChecking).tone).toBe('green')
    expect(groceryEyebrow(whileChecking).tone).toBe('green')
    expect(groceryEyebrow(withoutPlan).tone).toBe('muted')
  })

  it('shows the no-plan eyebrow in muted when no plan is active', () => {
    const view = resolveGroceryView(makeQuery(), null)

    expect(groceryEyebrow(view)).toEqual({text: GROCERY_NO_PLAN_EYEBROW, tone: 'muted'})
  })

  it('renders no half-built range for the loading and error states', () => {
    const loading = groceryEyebrow(resolveGroceryView(makeQuery({isLoading: true}), PLAN_ID))
    const failed = groceryEyebrow(resolveGroceryView(makeQuery({isError: true}), PLAN_ID))

    expect(loading).toEqual({text: '', tone: 'muted'})
    expect(failed).toEqual({text: '', tone: 'muted'})
    expect(loading.text).not.toContain('undefined')
    expect(loading.text).not.toContain('NaN')
    expect(failed.text).not.toContain('undefined')
    expect(failed.text).not.toContain('NaN')
  })

  it('keeps the plan range on an empty list, which is not the no-plan state', () => {
    const emptyList = makeList({totalCount: 0, sections: [], checkedItems: []})
    const view = resolveGroceryView(makeQuery({data: emptyList}), PLAN_ID)

    expect(groceryEyebrow(view)).toEqual({text: PLAN_RANGE_TEXT, tone: 'green'})
    expect(groceryEyebrow(view).text).not.toBe(GROCERY_NO_PLAN_EYEBROW)
  })
})

describe('countFlaggedItems', () => {
  it('returns zero for an empty list', () => {
    expect(countFlaggedItems([])).toBe(0)
  })

  it('returns zero when no row carries a flag', () => {
    expect(countFlaggedItems([makeItem(), makeItem({id: 'item-avocado', isChecked: true})])).toBe(0)
  })

  it('counts a single flagged row among unflagged ones', () => {
    const items = [makeItem(), makeFlaggedItem('item-chicken'), makeItem({id: 'item-lime'})]

    expect(countFlaggedItems(items)).toBe(1)
  })

  it('counts every flagged row', () => {
    const items = [
      makeFlaggedItem('item-chicken'),
      makeFlaggedItem('item-salmon'),
      makeFlaggedItem('item-feta'),
      makeItem()
    ]

    expect(countFlaggedItems(items)).toBe(3)
  })
})

describe('groceryBanner', () => {
  describe('no banner', () => {
    it('returns null when the list carries no banner', () => {
      expect(groceryBanner(null, 0)).toBeNull()
    })

    it('returns null when flags exist but no banner was sent', () => {
      expect(groceryBanner(null, 3)).toBeNull()
    })
  })

  describe('updated after swap', () => {
    it('renders the success tick banner naming the swapped slot', () => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: 'lunch'}, 0)

      expect(content?.tone).toBe('success')
      expect(content?.glyph).toBe('tick')
      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEMPLATE.replace('{slot}', 'lunch'))
      expect(content?.body).toContain('lunch')
    })

    it('states the swap without inventing a slot when the banner names none', () => {
      const content = groceryBanner({code: 'updated_after_swap'}, 0)

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(content?.body).not.toContain('undefined')
      expect(content?.body).not.toContain('{')
    })

    it('states the swap without a slot for a slot code it does not know', () => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: UNKNOWN_MEAL_SLOT}, 0)

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(content?.body).not.toContain('undefined')
    })

    it.each(PROTOTYPE_KEYS)('states the swap without a slot for the inherited slot name %s', key => {
      const content = groceryBanner({code: 'updated_after_swap', mealSlot: key}, 0)

      expect(content?.body).toBe(GROCERY_UPDATED_AFTER_SWAP_TEXT)
      expect(typeof content?.body).toBe('string')
      expect(content?.body).not.toContain('function')
      expect(content?.body).not.toContain('[object')
    })

    it('gives an inherited slot name the same banner as a slot code it does not know', () => {
      const inherited = groceryBanner({code: 'updated_after_swap', mealSlot: INHERITED_KEY}, 0)
      const unknown = groceryBanner({code: 'updated_after_swap', mealSlot: UNKNOWN_MEAL_SLOT}, 0)

      expect(inherited).toEqual(unknown)
    })
  })

  describe('amount increased', () => {
    it('names the one item in the singular banner', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: [FLAGGED_ITEM_NAME]}, 1)

      expect(content?.tone).toBe('error')
      expect(content?.glyph).toBe('warning')
      expect(content?.title).toBe(GROCERY_AMOUNT_INCREASED_TITLE)
      expect(content?.body).toBe(GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE.replace('{name}', FLAGGED_ITEM_NAME))
      expect(content?.body).toContain(FLAGGED_ITEM_NAME)
    })

    it('counts the items in the plural banner', () => {
      const itemNames = [FLAGGED_ITEM_NAME, 'Spinach', 'Feta']
      const content = groceryBanner({code: 'amount_increased', itemNames}, 3)

      expect(content?.tone).toBe('error')
      expect(content?.glyph).toBe('warning')
      expect(content?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '3'))
      expect(content?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '3'))
      expect(content?.title).toContain('3')
      expect(content?.body).toContain('3')
    })

    it('falls back to the plural banner when the flag names are missing', () => {
      const content = groceryBanner({code: 'amount_increased'}, 1)

      expect(content?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '1'))
      expect(content?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '1'))
      expect(content?.body).not.toContain('undefined')
      expect(content?.body).not.toContain('  ')
      expect(content?.body).not.toMatch(/^\s/)
    })

    it('falls back to the plural banner when the flag name list is empty', () => {
      const content = groceryBanner({code: 'amount_increased', itemNames: []}, 1)

      expect(content?.title).toBe(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE.replace('{n}', '1'))
      expect(content?.body).toBe(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE.replace('{n}', '1'))
      expect(content?.body).not.toContain('undefined')
      expect(content?.body).not.toContain('  ')
      expect(content?.body).not.toMatch(/^\s/)
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
})
