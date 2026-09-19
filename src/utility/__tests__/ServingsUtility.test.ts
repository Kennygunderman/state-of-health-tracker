import type {RecipeIngredient} from '@data/models/Recipe'

import {
  applyFractionPart,
  authoredAmountQualifier,
  DisplayedIngredient,
  formatIngredientAmount,
  formatIngredientQuantity,
  formatServingsDisplay,
  getFractionalPart,
  IngredientAmount,
  ingredientUnitPrecision,
  isFractionSelected,
  isGenericCountUnit,
  isInvariantUnitAbbreviation,
  MIN_SERVINGS,
  plannedPortionFactor,
  pluralizeUnit,
  roundIngredientAmount,
  scaleIngredientsForDisplay,
  scaleMacros,
  SERVING_FRACTIONS,
  snapToIngredientFraction,
  stepServings,
  WHOLE_RECIPE_FACTOR
} from '../ServingsUtility'

describe('formatServingsDisplay', () => {
  it('renders whole servings without a fraction glyph', () => {
    expect(formatServingsDisplay(1)).toBe('1')
    expect(formatServingsDisplay(3)).toBe('3')
  })

  it('renders known fractions with glyphs', () => {
    expect(formatServingsDisplay(0.25)).toBe('¼')
    expect(formatServingsDisplay(0.33)).toBe('⅓')
    expect(formatServingsDisplay(0.5)).toBe('½')
    expect(formatServingsDisplay(0.66)).toBe('⅔')
    expect(formatServingsDisplay(0.75)).toBe('¾')
  })

  it('combines whole part and fraction glyph', () => {
    expect(formatServingsDisplay(1.5)).toBe('1½')
    expect(formatServingsDisplay(2.75)).toBe('2¾')
    expect(formatServingsDisplay(1.33)).toBe('1⅓')
  })

  it('falls back to decimals for unknown fractions', () => {
    expect(formatServingsDisplay(1.2)).toBe('1.2')
  })
})

describe('stepServings', () => {
  it('walks up through the fraction chip stops', () => {
    expect(stepServings(1, 1)).toBe(1.25)
    expect(stepServings(1.25, 1)).toBe(1.33)
    expect(stepServings(1.33, 1)).toBe(1.5)
    expect(stepServings(1.5, 1)).toBe(1.66)
    expect(stepServings(1.66, 1)).toBe(1.75)
    expect(stepServings(1.75, 1)).toBe(2)
  })

  it('walks down through the fraction chip stops', () => {
    expect(stepServings(2, -1)).toBe(1.75)
    expect(stepServings(1.75, -1)).toBe(1.66)
    expect(stepServings(1.66, -1)).toBe(1.5)
    expect(stepServings(1.5, -1)).toBe(1.33)
    expect(stepServings(1.33, -1)).toBe(1.25)
    expect(stepServings(1.25, -1)).toBe(1)
    expect(stepServings(1, -1)).toBe(0.75)
  })

  it('snaps off-ladder values to the nearest stop in the pressed direction', () => {
    expect(stepServings(1.2, 1)).toBe(1.25)
    expect(stepServings(1.2, -1)).toBe(1)
  })

  it('clamps at the minimum servings', () => {
    expect(stepServings(0.25, -1)).toBe(MIN_SERVINGS)
    expect(stepServings(MIN_SERVINGS, -1)).toBe(MIN_SERVINGS)
    expect(stepServings(0.33, -1)).toBe(0.25)
  })
})

describe('applyFractionPart', () => {
  it('replaces the fractional part and keeps the whole part', () => {
    expect(applyFractionPart(1.5, 0.25)).toBe(1.25)
    expect(applyFractionPart(2, 0.33)).toBe(2.33)
  })

  it('works when there is no whole part', () => {
    expect(applyFractionPart(0.5, 0.75)).toBe(0.75)
  })
})

describe('getFractionalPart / isFractionSelected', () => {
  it('extracts the fractional part without float dust', () => {
    expect(getFractionalPart(1.25)).toBe(0.25)
    expect(getFractionalPart(2)).toBe(0)
  })

  it('matches selected fraction chips', () => {
    expect(isFractionSelected(1.25, 0.25)).toBe(true)
    expect(isFractionSelected(1.33, 0.33)).toBe(true)
    expect(isFractionSelected(1.5, 0.25)).toBe(false)
    expect(isFractionSelected(2, 0.5)).toBe(false)
  })
})

describe('scaleMacros', () => {
  it('multiplies per-serving values and rounds each', () => {
    const perServing = {calories: 231, protein: 1, carbs: 50, fat: 3}

    expect(scaleMacros(perServing, 1.5)).toEqual({calories: 347, protein: 2, carbs: 75, fat: 5})
  })

  it('is identity-ish at one serving', () => {
    const perServing = {calories: 96, protein: 0, carbs: 24, fat: 0}

    expect(scaleMacros(perServing, 1)).toEqual(perServing)
  })
})

describe('SERVING_FRACTIONS', () => {
  it('lists five fraction stops in ascending value order', () => {
    const values = SERVING_FRACTIONS.map(fraction => fraction.value)

    expect(values).toHaveLength(5)

    values.slice(1).forEach((value, index) => {
      expect(value).toBeGreaterThan(values[index])
    })
  })

  it('pins the glyph and value of every stop', () => {
    expect(SERVING_FRACTIONS).toEqual([
      {glyph: '¼', value: 0.25},
      {glyph: '⅓', value: 0.33},
      {glyph: '½', value: 0.5},
      {glyph: '⅔', value: 0.66},
      {glyph: '¾', value: 0.75}
    ])
  })

  it('keeps every value at two decimal places so a logged portion survives validation', () => {
    SERVING_FRACTIONS.forEach(fraction => {
      expect(Number.isInteger(fraction.value * 100)).toBe(true)
    })
  })

  it('starts at the smallest selectable serving', () => {
    const values = SERVING_FRACTIONS.map(fraction => fraction.value)

    expect(Math.min(...values)).toBe(MIN_SERVINGS)
  })
})

describe('MIN_SERVINGS', () => {
  it('is a quarter serving, matching the stepper clamp and the logging lower bound', () => {
    expect(MIN_SERVINGS).toBe(0.25)
  })
})

describe('stepServings across whole-number boundaries', () => {
  it('restarts the fraction ladder inside the next whole number', () => {
    expect(stepServings(2, 1)).toBe(2.25)
  })
})

describe('getFractionalPart boundaries', () => {
  it('rounds float dust away at the two-thirds stop', () => {
    expect(getFractionalPart(1.66)).toBe(0.66)
  })

  it('returns the value itself when there is no whole part', () => {
    expect(getFractionalPart(0.25)).toBe(0.25)
  })
})

describe('isFractionSelected across the fraction table', () => {
  it('selects every stop when it is the current fractional part', () => {
    SERVING_FRACTIONS.forEach(fraction => {
      expect(isFractionSelected(1 + fraction.value, fraction.value)).toBe(true)
    })
  })
})

describe('scaleMacros rounding and input safety', () => {
  it('rounds each value half-up so the logged total matches the server snapshot', () => {
    const perServing = {calories: 231, protein: 1, carbs: 3, fat: 5}

    expect(scaleMacros(perServing, 2.5)).toEqual({calories: 578, protein: 3, carbs: 8, fat: 13})
    expect(scaleMacros(perServing, 0.5)).toEqual({calories: 116, protein: 1, carbs: 2, fat: 3})
  })

  it('returns zeros for a zero-macro item', () => {
    const perServing = {calories: 0, protein: 0, carbs: 0, fat: 0}

    expect(scaleMacros(perServing, 3)).toEqual({calories: 0, protein: 0, carbs: 0, fat: 0})
  })

  it('leaves the caller per-serving object untouched', () => {
    const perServing = {calories: 231, protein: 1, carbs: 50, fat: 3}

    scaleMacros(perServing, 2)

    expect(perServing).toEqual({calories: 231, protein: 1, carbs: 50, fat: 3})
  })
})

/**
 * The one rule two screens share for turning a stored recipe ingredient amount into the amount on screen.
 *
 * What the three suites below pin, and why each is a decision someone could reverse:
 *
 *  - **The factor is `portionMultiplier / yieldServings`, and nothing else.** Stored amounts are whole-recipe
 *    amounts for `yieldServings` servings, and the server scaled the portion's NUTRITION by exactly these two
 *    numbers, so any other factor renders ingredients that contradict the calories printed beside them.
 *  - **A degenerate divisor degrades to the whole-recipe amount, never to `NaN` or `Infinity`.** A zero,
 *    negative or non-finite yield and a non-finite multiplier all fall back to 1. A visible stored amount is
 *    something a user can act on; 'NaN cup' is not. None of these is reachable for a published recipe, which
 *    is why they degrade rather than throw.
 *  - **The authored `displayText` wins at the whole-recipe factor, and is the last resort below it.** It is the
 *    amount the recipe publishes, written by a human and rendered by the same convention these helpers apply, so
 *    no derivation can improve on it — and it is the one value a client rendering and the server's own can be
 *    checked against each other on. Below that factor it is used only when the quantity cannot be scaled at all
 *    ('a pinch').
 *  - **An ingredient amount is a MEASUREMENT, and is not formatted like a servings figure.** The stepper echoes a
 *    typed number back losslessly because that number is POSTed as the portion eaten; an amount this app derived
 *    by dividing a recipe is written the way a recipe is written. Reusing the stepper's formatter here is what
 *    produced '0.31 cup', '1.88 clove', '187½ g' and '1¼ each'.
 *  - **Fractions, not decimals, in the units a cook measures.** Cups, spoons and counted things land on the five
 *    stops the fraction chips draw — ¼ ⅓ ½ ⅔ ¾ — at the nearest stop, and a tie takes the larger one. Grams and
 *    millilitres are whole numbers; ounces, pounds and litres take a tenth.
 *  - **A unit that names nothing is not printed, and one that names something is inflected.** '¼', never
 *    '¼ each'; '2 cups' and '1 cup' from the one stored spelling, because a recipe amount is continuous and its
 *    plural turns on `amount > 1`.
 *  - **An authored qualifier survives scaling.** '1¼ cups, chopped' halves to '⅔ cup, chopped' — the instruction
 *    travels with the amount it qualifies, inside `quantityText`, so the row's renderer needs no new field.
 *  - **Nothing ever reads as none of it.** An ingredient the recipe needs never renders '0 g' or '0 cup' because
 *    a portion divided it small.
 *  - **Floating-point dust never reaches the screen.** No '0.30000000000000004', no 'NaN cup'.
 *  - **The list mapping preserves order, names and the optional flag** — the instructions reference ingredients
 *    by position, so a reordering here would renumber what the user reads.
 */

const ingredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Brown rice, cooked',
  quantity: 3,
  unit: 'cup',
  gramWeight: 585,
  displayText: '3 cups',
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

// `displayText: null` by default, because a row that carries one SHORT-CIRCUITS the whole-recipe factor — that is
// the contract, and it would mask every derivation the suites below exist to pin. The cases that test the
// authored text supply it explicitly, and a null one is a shape the decoder genuinely produces.
const amount = (overrides: Partial<IngredientAmount> = {}): IngredientAmount => ({
  quantity: 2,
  unit: 'cup',
  displayText: null,
  ...overrides
})

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

describe('plannedPortionFactor', () => {
  describe('a recipe that can be divided', () => {
    it('divides one serving of a two-serving recipe in half', () => {
      expect(plannedPortionFactor(1, 2)).toBe(0.5)
    })

    it('applies the multiplier and the yield together', () => {
      expect(plannedPortionFactor(1.5, 4)).toBe(0.375)
      expect(plannedPortionFactor(2, 2)).toBe(1)
      expect(plannedPortionFactor(0.5, 1)).toBe(0.5)
    })

    it('leaves a single-serving recipe at one serving unscaled', () => {
      expect(plannedPortionFactor(1, 1)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('a yield that cannot divide', () => {
    it('falls back to the whole-recipe amount for zero and for a negative yield', () => {
      expect(plannedPortionFactor(1, 0)).toBe(WHOLE_RECIPE_FACTOR)
      expect(plannedPortionFactor(1, -2)).toBe(WHOLE_RECIPE_FACTOR)
    })

    it.each(NON_FINITE)('falls back to the whole-recipe amount for a yield of %p', notDivisible => {
      expect(plannedPortionFactor(1, notDivisible)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('a multiplier that is not a number', () => {
    it.each(NON_FINITE)('falls back to the whole-recipe amount for a multiplier of %p', unusable => {
      expect(plannedPortionFactor(unusable, 2)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('determinism', () => {
    it('returns the same factor for the same inputs', () => {
      expect(plannedPortionFactor(1.25, 3)).toBe(plannedPortionFactor(1.25, 3))
    })
  })
})

describe('snapToIngredientFraction', () => {
  describe('the five stops the fraction chips draw', () => {
    it('renders each of them from its exact value', () => {
      expect(snapToIngredientFraction(0.25).text).toBe('¼')
      expect(snapToIngredientFraction(1 / 3).text).toBe('⅓')
      expect(snapToIngredientFraction(0.5).text).toBe('½')
      expect(snapToIngredientFraction(2 / 3).text).toBe('⅔')
      expect(snapToIngredientFraction(0.75).text).toBe('¾')
    })

    it('renders a third and two thirds from the decimals either side of them', () => {
      // The defect: the servings chips store ⅔ as 0.66 and a recipe division produces 0.666…, so an
      // exact-match lookup found neither and printed '0.67'.
      expect(snapToIngredientFraction(0.66).text).toBe('⅔')
      expect(snapToIngredientFraction(0.67).text).toBe('⅔')
      expect(snapToIngredientFraction(0.33).text).toBe('⅓')
      expect(snapToIngredientFraction(0.34).text).toBe('⅓')
    })
  })

  describe('an amount between two stops', () => {
    it('takes the nearer one', () => {
      expect(snapToIngredientFraction(0.2).text).toBe('¼')
      expect(snapToIngredientFraction(0.3125).text).toBe('⅓')
      expect(snapToIngredientFraction(0.4).text).toBe('⅓')
      expect(snapToIngredientFraction(0.6).text).toBe('⅔')
      expect(snapToIngredientFraction(0.8).text).toBe('¾')
    })

    it('takes the larger one at every exact midpoint between two stops', () => {
      // An eighth sits exactly between nothing and a quarter, and a cook reaches for the quarter. The last
      // midpoint carries into the whole number rather than rendering a glyph.
      expect(snapToIngredientFraction(0.125).text).toBe('¼')
      expect(snapToIngredientFraction((0.25 + 1 / 3) / 2).text).toBe('⅓')
      expect(snapToIngredientFraction((1 / 3 + 0.5) / 2).text).toBe('½')
      expect(snapToIngredientFraction((0.5 + 2 / 3) / 2).text).toBe('⅔')
      expect(snapToIngredientFraction((2 / 3 + 0.75) / 2).text).toBe('¾')
      expect(snapToIngredientFraction(0.875).text).toBe('1')
    })

    it('resolves a midpoint the same way however the arithmetic reached it', () => {
      // 5/12 is the true midpoint between ⅓ and ½, and the nearest double to it sits a hair BELOW that
      // midpoint — so an exact comparison would answer '⅓' for one spelling of the division and '½' for
      // the other. Both spellings must render one amount.
      expect(snapToIngredientFraction(1.25 * (1 / 3)).text).toBe('½')
      expect(snapToIngredientFraction(1.25 / 3).text).toBe('½')
      expect(snapToIngredientFraction(5 / 12).text).toBe('½')
    })
  })

  describe('the bounds of the ladder', () => {
    it('renders a whole number with no glyph', () => {
      expect(snapToIngredientFraction(2)).toEqual({text: '2', value: 2})
      expect(snapToIngredientFraction(12)).toEqual({text: '12', value: 12})
    })

    it('carries a snap to one into the whole number', () => {
      // Never '1 cups' for 1.9 of them, and never '0' for 0.95.
      expect(snapToIngredientFraction(1.9)).toEqual({text: '2', value: 2})
      expect(snapToIngredientFraction(0.95)).toEqual({text: '1', value: 1})
    })

    it('keeps a whole part beside its glyph', () => {
      expect(snapToIngredientFraction(1.5).text).toBe('1½')
      expect(snapToIngredientFraction(2.25).text).toBe('2¼')
      expect(snapToIngredientFraction(1.25).text).toBe('1¼')
    })

    it('renders a true zero as zero', () => {
      expect(snapToIngredientFraction(0)).toEqual({text: '0', value: 0})
    })

    it('renders a positive amount that would round away as the smallest stop', () => {
      // A row the recipe needs must not read as none of it.
      expect(snapToIngredientFraction(0.01).text).toBe('¼')
      expect(snapToIngredientFraction(0.0001).text).toBe('¼')
    })
  })

  describe('the value it reports', () => {
    it('is the snapped number rather than the input, because that is what decides a plural', () => {
      expect(snapToIngredientFraction(0.2).value).toBe(0.25)
      expect(snapToIngredientFraction(1.9).value).toBe(2)
      expect(snapToIngredientFraction(1.5).value).toBe(1.5)
      expect(snapToIngredientFraction(0.31).value).toBe(1 / 3)
    })
  })

  describe('degenerate input', () => {
    it.each(NON_FINITE)('has no rendering for %p', unusable => {
      expect(snapToIngredientFraction(unusable)).toEqual({text: '', value: 0})
    })

    it('keeps the sign of a negative amount', () => {
      expect(snapToIngredientFraction(-0.5).text).toBe('-½')
      expect(snapToIngredientFraction(-2).text).toBe('-2')
    })
  })
})

describe('ingredientUnitPrecision', () => {
  it('writes base units whole, because a kitchen scale reads no finer', () => {
    expect(ingredientUnitPrecision('g')).toBe('integer')
    expect(ingredientUnitPrecision('grams')).toBe('integer')
    expect(ingredientUnitPrecision('ml')).toBe('integer')
    expect(ingredientUnitPrecision('mg')).toBe('integer')
  })

  it('writes instrument-read measures to a tenth', () => {
    expect(ingredientUnitPrecision('oz')).toBe('tenth')
    expect(ingredientUnitPrecision('lb')).toBe('tenth')
    expect(ingredientUnitPrecision('kg')).toBe('tenth')
    expect(ingredientUnitPrecision('fl oz')).toBe('tenth')
  })

  it('writes kitchen measures and counted things in fractions', () => {
    expect(ingredientUnitPrecision('cup')).toBe('fraction')
    expect(ingredientUnitPrecision('tbsp')).toBe('fraction')
    expect(ingredientUnitPrecision('clove')).toBe('fraction')
    expect(ingredientUnitPrecision('each')).toBe('fraction')
    expect(ingredientUnitPrecision('')).toBe('fraction')
  })

  it('reads a unit however it was spaced or cased', () => {
    expect(ingredientUnitPrecision('  G  ')).toBe('integer')
    expect(ingredientUnitPrecision('FL   OZ')).toBe('tenth')
  })

  it('treats a unit it does not recognise as something counted', () => {
    expect(ingredientUnitPrecision('sprig')).toBe('fraction')
    expect(ingredientUnitPrecision('a pinch')).toBe('fraction')
  })
})

describe('roundIngredientAmount', () => {
  it('writes a base unit whole', () => {
    // The defect: half of 375 g read '187½ g', a measurement nobody takes.
    expect(roundIngredientAmount(187.5, 'integer')).toEqual({text: '188', value: 188})
    expect(roundIngredientAmount(150.001, 'integer')).toEqual({text: '150', value: 150})
  })

  it('writes a derived measure to a tenth, rounding a half up', () => {
    expect(roundIngredientAmount(6.25, 'tenth')).toEqual({text: '6.3', value: 6.3})
    expect(roundIngredientAmount(5.24, 'tenth')).toEqual({text: '5.2', value: 5.2})
  })

  it('keeps a true zero', () => {
    expect(roundIngredientAmount(0, 'integer')).toEqual({text: '0', value: 0})
    expect(roundIngredientAmount(0, 'tenth')).toEqual({text: '0', value: 0})
  })

  it('clamps an amount that would round away to a tenth instead', () => {
    // '0 g' would say the recipe needs none of it.
    expect(roundIngredientAmount(0.4, 'integer')).toEqual({text: '0.4', value: 0.4})
    expect(roundIngredientAmount(0.04, 'integer')).toEqual({text: '0.1', value: 0.1})
    expect(roundIngredientAmount(0.004, 'tenth')).toEqual({text: '0.1', value: 0.1})
    expect(roundIngredientAmount(-0.04, 'integer')).toEqual({text: '-0.1', value: -0.1})
  })

  it.each(NON_FINITE)('has no rendering for %p', unusable => {
    expect(roundIngredientAmount(unusable, 'integer')).toEqual({text: '', value: 0})
  })
})

describe('isGenericCountUnit', () => {
  it('recognises every placeholder the catalog stores', () => {
    expect(isGenericCountUnit('each')).toBe(true)
    expect(isGenericCountUnit('whole')).toBe(true)
    expect(isGenericCountUnit('piece')).toBe(true)
    expect(isGenericCountUnit('pieces')).toBe(true)
    expect(isGenericCountUnit('count')).toBe(true)
  })

  it('recognises one however it was spaced or cased', () => {
    expect(isGenericCountUnit('  Each ')).toBe(true)
    expect(isGenericCountUnit('EACH')).toBe(true)
  })

  it('leaves a unit that names something alone', () => {
    expect(isGenericCountUnit('cup')).toBe(false)
    expect(isGenericCountUnit('clove')).toBe(false)
    expect(isGenericCountUnit('')).toBe(false)
  })
})

describe('isInvariantUnitAbbreviation', () => {
  it('recognises the symbols that read the same at every amount', () => {
    expect(isInvariantUnitAbbreviation('g')).toBe(true)
    expect(isInvariantUnitAbbreviation('TBSP')).toBe(true)
    expect(isInvariantUnitAbbreviation(' fl oz ')).toBe(true)
    expect(isInvariantUnitAbbreviation('lbs')).toBe(true)
  })

  it('leaves an English noun to inflect', () => {
    expect(isInvariantUnitAbbreviation('cup')).toBe(false)
    expect(isInvariantUnitAbbreviation('gram')).toBe(false)
    expect(isInvariantUnitAbbreviation('')).toBe(false)
  })
})

describe('pluralizeUnit', () => {
  describe('the number it inflects for', () => {
    it('pluralises above one and not at or below it', () => {
      // The defect: '2 cup' and '4 clove'.
      expect(pluralizeUnit(2, 'cup')).toBe('cups')
      expect(pluralizeUnit(1, 'cup')).toBe('cup')
      expect(pluralizeUnit(1.25, 'cup')).toBe('cups')
      expect(pluralizeUnit(4, 'clove')).toBe('cloves')
    })

    it('keeps a fraction singular, which a whole-number count rule cannot', () => {
      // Halving an authored '3 cloves' must not read '½ cloves'.
      expect(pluralizeUnit(0.5, 'cloves')).toBe('clove')
      expect(pluralizeUnit(0.25, 'cups')).toBe('cup')
      expect(pluralizeUnit(0, 'cup')).toBe('cup')
    })
  })

  describe('the spelling the recipe stored', () => {
    it('inflects in whichever direction the amount needs', () => {
      // The seeded corpus spells both, 79 rows of 'cup' against 4 of 'cups'.
      expect(pluralizeUnit(1, 'cups')).toBe('cup')
      expect(pluralizeUnit(2, 'cups')).toBe('cups')
      expect(pluralizeUnit(1, 'cloves')).toBe('clove')
      expect(pluralizeUnit(3, 'clove')).toBe('cloves')
    })

    it('leaves an abbreviation and an absent unit untouched', () => {
      expect(pluralizeUnit(8, 'tbsp')).toBe('tbsp')
      expect(pluralizeUnit(24, 'oz')).toBe('oz')
      expect(pluralizeUnit(500, 'g')).toBe('g')
      expect(pluralizeUnit(2, '')).toBe('')
      expect(pluralizeUnit(2, '   ')).toBe('')
    })

    it('keeps the casing it was given', () => {
      expect(pluralizeUnit(2, 'Cup')).toBe('Cups')
      expect(pluralizeUnit(2, 'CUP')).toBe('CUPS')
      expect(pluralizeUnit(1, 'Cups')).toBe('Cup')
    })
  })

  describe('irregular and qualified units', () => {
    it('inflects the irregulars both ways', () => {
      expect(pluralizeUnit(12, 'egg')).toBe('eggs')
      expect(pluralizeUnit(1, 'eggs')).toBe('egg')
      expect(pluralizeUnit(2, 'leaf')).toBe('leaves')
      expect(pluralizeUnit(1, 'leaves')).toBe('leaf')
      expect(pluralizeUnit(2, 'slice')).toBe('slices')
    })

    it('inflects the measure rather than its qualifier', () => {
      expect(pluralizeUnit(2, 'cup, packed')).toBe('cups, packed')
      expect(pluralizeUnit(1, 'cups, packed')).toBe('cup, packed')
    })

    it('leaves a singular that already ends in s alone', () => {
      expect(pluralizeUnit(1, 'glass')).toBe('glass')
    })

    it.each(NON_FINITE)('leaves the unit alone for an amount of %p', unusable => {
      expect(pluralizeUnit(unusable, 'cup')).toBe('cup')
    })
  })
})

describe('formatIngredientAmount', () => {
  describe('a unit that names nothing', () => {
    it('is not printed', () => {
      // The defect: 57 of the 269 seeded rows read '1 each', '¼ each', '1¼ each'.
      expect(formatIngredientAmount(1, 'each')).toBe('1')
      expect(formatIngredientAmount(0.25, 'each')).toBe('¼')
      expect(formatIngredientAmount(1.25, 'each')).toBe('1¼')
      expect(formatIngredientAmount(2, 'whole')).toBe('2')
    })

    it('is not printed when there is no unit at all', () => {
      expect(formatIngredientAmount(2, '')).toBe('2')
      expect(formatIngredientAmount(0.5, '   ')).toBe('½')
    })
  })

  describe('a unit that names something', () => {
    it('is printed in the number the amount calls for', () => {
      expect(formatIngredientAmount(1, 'cup')).toBe('1 cup')
      expect(formatIngredientAmount(2, 'cup')).toBe('2 cups')
      expect(formatIngredientAmount(0.5, 'cup')).toBe('½ cup')
      expect(formatIngredientAmount(0, 'cup')).toBe('0 cup')
    })

    it('is trimmed before it is composed', () => {
      expect(formatIngredientAmount(2, '  cup  ')).toBe('2 cups')
    })

    it('keeps the ingredient its own unit rather than promoting it', () => {
      // A recipe that says 5 oz of chicken must not start saying 0.3 lb.
      expect(formatIngredientAmount(24, 'oz')).toBe('24 oz')
      expect(formatIngredientAmount(600, 'g')).toBe('600 g')
    })
  })

  describe('every defect the QA reproduction named, in one place', () => {
    it('renders each of them the way a recipe is written', () => {
      expect(formatIngredientAmount(6.25, 'oz')).toBe('6.3 oz')
      expect(formatIngredientAmount(0.9375, 'cup')).toBe('1 cup')
      expect(formatIngredientAmount(0.3125, 'cup')).toBe('⅓ cup')
      expect(formatIngredientAmount(1.875, 'clove')).toBe('2 cloves')
      expect(formatIngredientAmount(0.625, 'tbsp')).toBe('⅔ tbsp')
      expect(formatIngredientAmount(187.5, 'g')).toBe('188 g')
      expect(formatIngredientAmount(0.67, 'cup')).toBe('⅔ cup')
    })
  })

  describe('degenerate input', () => {
    it.each(NON_FINITE)('has no rendering for %p', unusable => {
      expect(formatIngredientAmount(unusable, 'cup')).toBe('')
    })
  })
})

describe('authoredAmountQualifier', () => {
  describe('the phrasing it recovers', () => {
    it('returns what the authored text carries beyond its own amount and unit', () => {
      // Real seeded rows: the preparation is the part of the row a cook acts on.
      expect(authoredAmountQualifier('1¼ cups, chopped', 1.25, 'cup')).toBe(', chopped')
      expect(authoredAmountQualifier('240 g, drained', 240, 'g')).toBe(', drained')
      expect(authoredAmountQualifier('½ cup leaves', 0.5, 'cup')).toBe(' leaves')
      expect(authoredAmountQualifier('1 banana', 1, 'each')).toBe(' banana')
      expect(authoredAmountQualifier('1½ medium tomatoes', 1.5, 'each')).toBe(' medium tomatoes')
    })

    it('returns nothing when the authored text is only its amount', () => {
      expect(authoredAmountQualifier('3 cups', 3, 'cup')).toBe('')
      expect(authoredAmountQualifier('188 g', 188, 'g')).toBe('')
    })
  })

  describe('what it refuses, because appending it would be wrong', () => {
    it('refuses a phrase bound to the amount it was written for', () => {
      // '(4 medium)' stops being true the moment the amount changes.
      expect(authoredAmountQualifier('480 g (4 medium)', 480, 'g')).toBe('')
    })

    it('refuses a row whose text disagrees with its own columns', () => {
      // A seed defect: 320 g stored, labelled '2 cups, drained'. No qualifier beats a mangled one.
      expect(authoredAmountQualifier('2 cups, drained', 320, 'g')).toBe('')
      expect(authoredAmountQualifier('3½ oz', 3.5, 'oz')).toBe('')
    })

    it('refuses a remainder that would split a word in half', () => {
      // '1 cupcake' starts with '1 cup', and 'cake' is not a qualifier.
      expect(authoredAmountQualifier('1 cupcake', 1, 'cup')).toBe('')
    })

    it('returns nothing when there is no authored text or no amount', () => {
      expect(authoredAmountQualifier(null, 1, 'cup')).toBe('')
      expect(authoredAmountQualifier(undefined, 1, 'cup')).toBe('')
      expect(authoredAmountQualifier('', 1, 'cup')).toBe('')
      expect(authoredAmountQualifier('   ', 1, 'cup')).toBe('')
      expect(authoredAmountQualifier('1 cup, sliced', Number.NaN, 'cup')).toBe('')
    })
  })
})

describe('formatIngredientQuantity', () => {
  describe('the whole-recipe factor', () => {
    it('returns the authored text verbatim, because no derivation improves on it', () => {
      expect(formatIngredientQuantity(amount({quantity: 2, displayText: '2 cups'}), WHOLE_RECIPE_FACTOR)).toBe('2 cups')
      expect(
        formatIngredientQuantity(amount({quantity: 1, unit: 'each', displayText: '1 banana'}), WHOLE_RECIPE_FACTOR)
      ).toBe('1 banana')
    })

    it('recomputes when the row carries no authored text', () => {
      expect(formatIngredientQuantity(amount({quantity: 2}), WHOLE_RECIPE_FACTOR)).toBe('2 cups')
      expect(formatIngredientQuantity(amount({quantity: 2, displayText: '   '}), WHOLE_RECIPE_FACTOR)).toBe('2 cups')
    })
  })

  describe('a factor that divides the recipe', () => {
    it('renders a scaled amount rather than the stored one', () => {
      expect(formatIngredientQuantity(amount({quantity: 10, unit: 'oz'}), 0.5)).toBe('5 oz')
      // The defect this helper exists to prevent: '3 cups' is the whole recipe, and the portion is one cup.
      expect(formatIngredientQuantity(amount({quantity: 3, displayText: '3 cups'}), 1 / 3)).toBe('1 cup')
    })

    it('writes a fraction with the glyphs the chips draw', () => {
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.25)).toBe('¼ cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 1 / 3)).toBe('⅓ cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.5)).toBe('½ cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 2 / 3)).toBe('⅔ cup')
      expect(formatIngredientQuantity(amount({quantity: 3}), 0.25)).toBe('¾ cup')
      expect(formatIngredientQuantity(amount({quantity: 6}), 0.25)).toBe('1½ cups')
    })

    it('renders no bare decimal for an amount off the ladder', () => {
      // The defect: '0.31 cup', '0.94 cup', '1.88 clove'.
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.4)).toBe('⅓ cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.125)).toBe('¼ cup')
      expect(formatIngredientQuantity(amount({quantity: 1.5, unit: 'cup'}), 0.625)).toBe('1 cup')
      expect(formatIngredientQuantity(amount({quantity: 4, unit: 'clove'}), 0.469)).toBe('2 cloves')
    })

    it('writes a base unit whole and a derived one to a tenth', () => {
      expect(formatIngredientQuantity(amount({quantity: 375, unit: 'g'}), 0.5)).toBe('188 g')
      expect(formatIngredientQuantity(amount({quantity: 10, unit: 'oz'}), 0.625)).toBe('6.3 oz')
    })

    it('leaves a placeholder unit off and inflects one that names something', () => {
      expect(formatIngredientQuantity(amount({quantity: 2, unit: 'each'}), 0.625)).toBe('1¼')
      expect(formatIngredientQuantity(amount({quantity: 2, unit: 'cup'}), 0.625)).toBe('1¼ cups')
      expect(formatIngredientQuantity(amount({quantity: 2, unit: 'cups'}), 0.5)).toBe('1 cup')
    })

    it('carries the authored qualifier across the scaling', () => {
      expect(
        formatIngredientQuantity(amount({quantity: 1.25, unit: 'cup', displayText: '1¼ cups, chopped'}), 0.5)
      ).toBe('⅔ cup, chopped')
      expect(formatIngredientQuantity(amount({quantity: 1, unit: 'each', displayText: '1 banana'}), 0.5)).toBe(
        '½ banana'
      )
      expect(formatIngredientQuantity(amount({quantity: 240, unit: 'g', displayText: '240 g, drained'}), 0.5)).toBe(
        '120 g, drained'
      )
    })

    it('never renders an ingredient the recipe needs as none of it', () => {
      expect(formatIngredientQuantity(amount({quantity: 1, unit: 'g'}), 0.125)).toBe('0.1 g')
      expect(formatIngredientQuantity(amount({quantity: 1, unit: 'cup'}), 0.01)).toBe('¼ cup')
    })

    it('keeps floating point dust off the screen', () => {
      expect(formatIngredientQuantity(amount({quantity: 0.1 + 0.2, unit: null}), 1.0000000000000002)).toBe('⅓')
      expect(formatIngredientQuantity(amount({quantity: 150.001, unit: 'g'}), 0.9999999999)).toBe('150 g')
    })
  })

  describe('the unit', () => {
    it('is trimmed before it is composed', () => {
      expect(formatIngredientQuantity(amount({quantity: 300, unit: '  g  '}), 0.5)).toBe('150 g')
    })

    it('is omitted for a counted ingredient', () => {
      expect(formatIngredientQuantity(amount({quantity: 4, unit: ''}), 0.5)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 4, unit: '   '}), 0.5)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 4, unit: null}), 0.5)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 4, unit: undefined}), 0.5)).toBe('2')
    })
  })

  describe('a quantity that cannot be scaled', () => {
    it.each(NON_FINITE)('falls back to the stored display text for a quantity of %p', unusable => {
      expect(formatIngredientQuantity(amount({quantity: unusable, displayText: 'a pinch'}), 0.5)).toBe('a pinch')
    })

    it('trims that fallback', () => {
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: ' a pinch '}), 0.5)).toBe('a pinch')
    })

    it('renders nothing rather than NaN when there is no text either', () => {
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: null}), 0.5)).toBe('')
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: '   '}), 0.5)).toBe('')
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: undefined}), 0.5)).toBe('')
    })
  })

  describe('output never leaks a numeric artefact', () => {
    it.each([
      [Number.NaN, 2],
      [1, Number.NaN],
      [1, Number.POSITIVE_INFINITY]
    ])('renders no NaN or Infinity for a multiplier of %p and a yield of %p', (multiplier, yieldServings) => {
      const text = formatIngredientQuantity(
        amount({quantity: 2}),
        plannedPortionFactor(multiplier as number, yieldServings as number)
      )

      expect(text).not.toContain('NaN')
      expect(text).not.toContain('Infinity')
      expect(text).toBe('2 cups')
    })

    it.each(NON_FINITE)('falls back to the whole recipe for a factor of %p reached any other way', unusable => {
      expect(formatIngredientQuantity(amount({quantity: 2, displayText: '2 cups'}), unusable)).toBe('2 cups')
      expect(formatIngredientQuantity(amount({quantity: 2}), unusable)).toBe('2 cups')
    })
  })
})

/**
 * Real rows from the seeded recipe corpus, with the amounts the SERVER renders for them.
 *
 * The one assertion that proves the client and the server agree rather than merely both looking reasonable: each
 * `displayText` below is the text `backend/src/services/recipe.logic.ts` wrote into `recipe_ingredients`, and the
 * scaled column is what its `scaleIngredients` produces at that factor. A change to either convention that is
 * not made to both breaks this table.
 */
describe('the seeded recipe corpus', () => {
  const CORPUS: readonly [quantity: number, unit: string, authored: string, factor: number, scaled: string][] = [
    // Every unit spelling the 269 seeded rows use, at the factor a 1.25 portion of a 2-serving recipe needs.
    [10, 'oz', '10 oz', 0.625, '6.3 oz'],
    [1.5, 'cup', '1½ cups', 0.625, '1 cup'],
    [2, 'cups', '2 cups', 0.625, '1¼ cups'],
    [2, 'each', '2', 0.625, '1¼'],
    [0.5, 'cup', '½ cup', 0.625, '⅓ cup'],
    [3, 'clove', '3 cloves', 0.625, '2 cloves'],
    [1, 'tbsp', '1 tbsp', 0.625, '⅔ tbsp'],
    [1.5, 'tsp', '1½ tsp', 0.625, '1 tsp'],
    [300, 'g', '300 g', 0.625, '188 g'],
    [1, 'slice', '1 slice', 0.625, '⅔ slice'],
    // Authored qualifiers, carried across a halving.
    [1.25, 'cup', '1¼ cups, chopped', 0.5, '⅔ cup, chopped'],
    [0.75, 'cup', '¾ cup, chopped', 0.5, '⅓ cup, chopped'],
    [240, 'g', '240 g, drained', 0.5, '120 g, drained'],
    [0.5, 'cup', '½ cup leaves', 0.5, '¼ cup leaves'],
    [1, 'each', '1 chili pepper', 0.5, '½ chili pepper'],
    [1, 'each', '1 tomato, chopped', 0.5, '½ tomato, chopped'],
    [1.5, 'each', '1½ medium tomatoes', 0.5, '¾ medium tomatoes'],
    // A qualifier is never itself inflected: the seed wrote 'cans', and halving the amount leaves the word as the
    // recipe wrote it rather than guessing at its grammar. Recorded because it is visible, and because the
    // alternative is a heuristic that would mangle ', chopped'.
    [2, 'each', '2 cans, drained', 0.5, '1 cans, drained'],
    // A row whose authored text disagrees with its own columns contributes no qualifier at all.
    [320, 'g', '2 cups, drained', 0.5, '160 g'],
    [10.5, 'oz', '10½ oz', 0.5, '5.3 oz']
  ]

  it.each(CORPUS)('renders %p %s (authored %p) at a factor of %p as %p', (quantity, unit, authored, factor, scaled) => {
    expect(formatIngredientQuantity({quantity, unit, displayText: authored}, factor)).toBe(scaled)
  })

  it.each(CORPUS)(
    'returns the authored %p %s text (%p) unchanged at the whole-recipe factor',
    (quantity, unit, authored) => {
      expect(formatIngredientQuantity({quantity, unit, displayText: authored}, WHOLE_RECIPE_FACTOR)).toBe(authored)
    }
  )
})

describe('scaleIngredientsForDisplay', () => {
  describe('the rows it builds', () => {
    it('carries the name, the scaled amount and the optional flag', () => {
      const rows: DisplayedIngredient[] = scaleIngredientsForDisplay(
        [ingredient({name: 'Olive oil', quantity: 3, unit: 'tbsp', isOptional: true})],
        plannedPortionFactor(1, 2)
      )

      expect(rows).toEqual([{name: 'Olive oil', quantityText: '1½ tbsp', isOptional: true}])
    })

    it('keeps the order it was given, because the instructions reference ingredients by position', () => {
      const rows = scaleIngredientsForDisplay(
        [
          ingredient({name: 'Chicken breast', quantity: 10, unit: 'oz'}),
          ingredient({name: 'Black beans', quantity: 1, unit: 'cup'}),
          ingredient({name: 'Avocado', quantity: 1, unit: ''})
        ],
        plannedPortionFactor(1, 2)
      )

      expect(rows.map(row => row.name)).toEqual(['Chicken breast', 'Black beans', 'Avocado'])
      expect(rows.map(row => row.quantityText)).toEqual(['5 oz', '½ cup', '½'])
    })

    it('returns an empty list for an empty recipe', () => {
      expect(scaleIngredientsForDisplay([], 0.5)).toEqual([])
    })
  })

  describe('purity', () => {
    it('does not mutate the ingredients it was given', () => {
      const ingredients = [ingredient()]
      const snapshot = JSON.stringify(ingredients)

      scaleIngredientsForDisplay(ingredients, 0.5)

      expect(JSON.stringify(ingredients)).toBe(snapshot)
    })

    it('returns the same rows for the same inputs', () => {
      const ingredients = [ingredient(), ingredient({name: 'Lime', quantity: 2, unit: ''})]

      expect(scaleIngredientsForDisplay(ingredients, 0.5)).toEqual(scaleIngredientsForDisplay(ingredients, 0.5))
    })
  })
})
