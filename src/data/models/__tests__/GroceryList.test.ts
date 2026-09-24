import {GroceryItem, GroceryList, retainKnownAisles} from '../GroceryList'

const SPINACH_ID = 'item-spinach'
const CHICKEN_ID = 'item-chicken'
const RICE_ID = 'item-rice'

const makeItem = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
  id: SPINACH_ID,
  catalogFoodId: 'food-spinach',
  foodState: 'raw',
  name: 'Spinach',
  quantityGrams: 420,
  displayText: '7 cups',
  isChecked: false,
  flag: null,
  ...overrides
})

const makeList = (overrides: Partial<GroceryList> = {}): GroceryList => ({
  planId: 'plan-1',
  planRevision: 3,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  totalCount: 3,
  checkedCount: 1,
  banner: null,
  sections: [],
  checkedItems: [],
  ...overrides
})

// What convertGroceryList produces: every sectioned row stamped with its section's aisle, every checked row
// bare, because the answer states the category per section and holds the checked rows out of them (0.5.2).
const makeFetchedList = (overrides: Partial<GroceryList> = {}): GroceryList =>
  makeList({
    sections: [
      {category: 'produce', items: [makeItem({category: 'produce'})]},
      {
        category: 'grains_bread',
        items: [makeItem({id: RICE_ID, name: 'Brown rice', displayText: '3 cups dry', category: 'grains_bread'})]
      }
    ],
    checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', displayText: '3.1 lb', isChecked: true})],
    ...overrides
  })

describe('retainKnownAisles', () => {
  describe('stamping a checked row', () => {
    it('takes the aisle the previous list held the row in', () => {
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}]
      })

      const retained = retainKnownAisles(makeFetchedList(), previous)

      expect(retained.checkedItems[0].category).toBe('protein')
    })

    it('takes the stamp the previous list already carried on its own checked row', () => {
      const previous = makeList({
        checkedItems: [
          makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true, category: 'dairy_alternatives'})
        ]
      })

      const retained = retainKnownAisles(makeFetchedList(), previous)

      expect(retained.checkedItems[0].category).toBe('dairy_alternatives')
    })

    it('prefers the aisle the previous list stated over a stamp left on its checked row', () => {
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}],
        checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true, category: 'pantry_other'})]
      })

      const retained = retainKnownAisles(makeFetchedList(), previous)

      expect(retained.checkedItems[0].category).toBe('protein')
    })

    it('leaves every other member of the answer as it arrived', () => {
      const next = makeFetchedList()
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}]
      })

      const retained = retainKnownAisles(next, previous)

      expect(retained.sections).toBe(next.sections)
      expect(retained.totalCount).toBe(next.totalCount)
      expect(retained.checkedCount).toBe(next.checkedCount)
      expect(retained.planRevision).toBe(next.planRevision)
      expect(retained.banner).toBe(next.banner)
    })
  })

  describe('what it declines to stamp', () => {
    it('leaves a category the new answer states, because the server has just re-filed that row', () => {
      const next = makeFetchedList({
        checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true, category: 'produce'})]
      })
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}]
      })

      expect(retainKnownAisles(next, previous).checkedItems[0].category).toBe('produce')
    })

    it('leaves a row the previous list never held without an aisle', () => {
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: 'item-salmon', name: 'Salmon fillet'})]}]
      })

      const retained = retainKnownAisles(makeFetchedList(), previous)

      expect(retained.checkedItems[0].category).toBeUndefined()
    })
  })

  describe('identity', () => {
    it('returns the answer itself when no checked row needed stamping', () => {
      const next = makeFetchedList()
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: 'item-salmon', name: 'Salmon fillet'})]}]
      })

      expect(retainKnownAisles(next, previous)).toBe(next)
    })

    it('returns the answer itself when the answer holds no checked rows', () => {
      const next = makeFetchedList({checkedItems: []})
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}]
      })

      expect(retainKnownAisles(next, previous)).toBe(next)
    })

    it('returns the answer itself on a cold start, when there is no previous list', () => {
      const next = makeFetchedList()

      expect(retainKnownAisles(next, undefined)).toBe(next)
    })

    it('keeps the identity of each checked row it did not stamp', () => {
      const untouched = makeItem({id: 'item-salmon', name: 'Salmon fillet', isChecked: true})
      const next = makeFetchedList({
        checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true}), untouched]
      })
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}]
      })

      const retained = retainKnownAisles(next, previous)

      expect(retained).not.toBe(next)
      expect(retained.checkedItems[1]).toBe(untouched)
    })
  })

  describe('purity', () => {
    it('mutates neither the answer nor the previous list', () => {
      const next = makeFetchedList()
      const previous = makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}],
        checkedItems: [makeItem({id: RICE_ID, name: 'Brown rice', isChecked: true, category: 'grains_bread'})]
      })
      const nextClone = JSON.parse(JSON.stringify(next)) as GroceryList
      const previousClone = JSON.parse(JSON.stringify(previous)) as GroceryList

      retainKnownAisles(next, previous)

      expect(next).toEqual(nextClone)
      expect(previous).toEqual(previousClone)
    })
  })
})
