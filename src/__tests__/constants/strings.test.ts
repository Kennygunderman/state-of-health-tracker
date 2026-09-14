// Not colocated beside its subject because `src/__tests__/constants/` is where this repository keeps a
// constants-module test. `catalogCategoryLabel` is the one place a catalog category — an open server string, the
// decoder types it `io.string` because categories are data — becomes copy, so every code the table may never
// have heard of has to land on the fallback. The labels are pinned verbatim here: they are authored Figma copy,
// not values derived from anything a future change could recompute.
import {CATALOG_CATEGORY_FALLBACK_LABEL, CATALOG_CATEGORY_LABELS, catalogCategoryLabel} from '@constants/strings'

// The complete authored table. Listing it out pins both the set of codes the catalog can send and the copy each
// one shows, so deleting or re-wording a row fails here rather than silently degrading a row to "Food".
const EXPECTED_LABELS: Record<string, string> = {
  produce_vegetable: 'Vegetable',
  produce_fruit: 'Fruit',
  protein_meat: 'Meat',
  protein_poultry: 'Poultry',
  protein_seafood: 'Seafood',
  protein_egg: 'Egg',
  protein_plant: 'Plant protein',
  dairy: 'Dairy',
  dairy_alternative: 'Dairy alternative',
  grain: 'Grain',
  bread_bakery: 'Bread & bakery',
  legume: 'Legume',
  nut_seed: 'Nut & seed',
  oil_fat: 'Oil & fat',
  condiment_sauce: 'Condiment & sauce',
  spice_herb: 'Spice & herb',
  beverage: 'Beverage',
  snack: 'Snack',
  sweet: 'Sweet',
  prepared_meal: 'Prepared dish',
  other: 'Other'
}

// The names an ordinary object literal answers to without ever being given them. A category equal to any of
// these is what makes a raw `table[code]` return a function or an object instead of nothing.
const PROTOTYPE_KEYS = [
  'constructor',
  'toString',
  'toLocaleString',
  'valueOf',
  '__proto__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable'
]

const UNKNOWN_CATEGORY = 'frozen_novelty'

describe('catalogCategoryLabel', () => {
  describe('authored categories', () => {
    it.each(Object.entries(EXPECTED_LABELS))('labels %s as %s', (code, label) => {
      expect(catalogCategoryLabel(code)).toBe(label)
      expect(label.length).toBeGreaterThan(0)
    })

    it('carries exactly the authored codes and nothing else', () => {
      expect(Object.keys(CATALOG_CATEGORY_LABELS).sort()).toEqual(Object.keys(EXPECTED_LABELS).sort())
    })
  })

  describe('codes the table does not carry', () => {
    it('falls back for a code this build has never heard of', () => {
      expect(catalogCategoryLabel(UNKNOWN_CATEGORY)).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })

    it('falls back for an empty category', () => {
      expect(catalogCategoryLabel('')).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })

    it('keeps the fallback distinct from the "other" category, which is a known category', () => {
      expect(CATALOG_CATEGORY_FALLBACK_LABEL).not.toBe(EXPECTED_LABELS.other)
    })
  })

  describe('inherited Object.prototype names', () => {
    it.each(PROTOTYPE_KEYS)('falls back to copy for the inherited name %s', key => {
      const label = catalogCategoryLabel(key)

      expect(label).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
      expect(typeof label).toBe('string')
    })

    // The hazard itself: a bare index answers 'constructor' with a function, which is not nullish, so a `??`
    // fallback behind one never fires and a function reaches React text. Reading through an own-property lookup
    // is what keeps the fallback reachable.
    it('returns copy where a bare index returns a non-string', () => {
      const inherited = 'constructor'
      const rawIndex: unknown = (CATALOG_CATEGORY_LABELS as unknown as Record<string, unknown>)[inherited]

      expect(typeof rawIndex).toBe('function')
      expect(catalogCategoryLabel(inherited)).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })
  })
})
