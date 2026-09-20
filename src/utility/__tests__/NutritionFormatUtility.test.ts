import {NutritionTargets} from '@data/models/NutritionTargets'
import {formatIngredientQuantity, formatServingsDisplay, WHOLE_RECIPE_FACTOR} from '@utility/ServingsUtility'

import {MEAL_PLAN_UNIT_VALUE_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import {
  confirmedTargetValues,
  formatCalories,
  formatCatalogPortionText,
  formatCount,
  formatMacroGrams,
  formatMacroPair,
  formatSignedCalories,
  hasAnyTargetValue,
  isPlannerConfirmedTargets,
  toCountValue
} from '../NutritionFormatUtility'

const CAL_SUFFIX = 'cal'
const MINUS_SIGN = '\u2212'
const PARITY_VALUES = [0, 1, 999, 1000, 1940, 12345, 1905.5]

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 2100, protein: 150, carbs: 220, fat: 70},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

describe('formatCalories', () => {
  describe('Figma figures', () => {
    it('renders the review target as 1,940', () => {
      expect(formatCalories(1940)).toBe('1,940')
    })

    it('renders the planned day total as 1,905', () => {
      expect(formatCalories(1905.4)).toBe('1,905')
    })

    it('renders the swap preview total as 1,835', () => {
      expect(formatCalories(1835)).toBe('1,835')
    })

    it('renders a meal figure under a thousand ungrouped', () => {
      expect(formatCalories(610)).toBe('610')
    })
  })

  describe('grouping boundary', () => {
    it('leaves three digits ungrouped', () => {
      expect(formatCalories(999)).toBe('999')
    })

    it('groups at four digits', () => {
      expect(formatCalories(1000)).toBe('1,000')
    })

    it('groups a five digit figure', () => {
      expect(formatCalories(12345)).toBe('12,345')
    })
  })

  describe('rounding', () => {
    it('rounds zero to 0', () => {
      expect(formatCalories(0)).toBe('0')
    })

    it('rounds down below the half boundary', () => {
      expect(formatCalories(1904.4)).toBe('1,904')
    })

    it('rounds up at the half boundary', () => {
      expect(formatCalories(1904.5)).toBe('1,905')
    })

    it('rounds half up across the grouping separator', () => {
      expect(formatCalories(1905.5)).toBe('1,906')
    })
  })

  describe('inputs the diary never produces', () => {
    it('renders a negative with an ASCII hyphen, since only formatSignedCalories uses the typographic minus', () => {
      expect(formatCalories(-70)).toBe('-70')
    })

    it('keeps the shipped negative-zero output for a value that rounds to -0', () => {
      expect(formatCalories(-0.4)).toBe('-0')
    })

    it('renders NaN as the string NaN, matching the shipped diary formatter', () => {
      expect(formatCalories(NaN)).toBe('NaN')
    })
  })
})

describe('toCountValue', () => {
  describe('the whole counts the server sends', () => {
    it.each([0, 1, 2, 21, 999, 1000, 1234, 1234567])('passes %p through unchanged', value => {
      expect(toCountValue(value)).toBe(value)
    })
  })

  describe('a negative count, which SQL count() cannot produce', () => {
    it.each([-1, -3, -0.4, -1234])('reads %p as 0', value => {
      expect(toCountValue(value)).toBe(0)
    })

    it('answers a positive zero, so a formatter can never render a negative zero', () => {
      expect(Object.is(toCountValue(-0), 0)).toBe(true)
    })
  })

  describe('a fractional count', () => {
    it('rounds a sub-half fraction down to nothing counted', () => {
      expect(toCountValue(0.4)).toBe(0)
    })

    it('rounds the half boundary up', () => {
      expect(toCountValue(1.5)).toBe(2)
    })

    it('rounds below the half boundary down', () => {
      expect(toCountValue(2.4)).toBe(2)
    })

    it('rounds up across the grouping separator', () => {
      expect(toCountValue(1233.5)).toBe(1234)
    })
  })

  describe('a value that is not a number at all', () => {
    it.each([NaN, Infinity, -Infinity])('reads %p as 0', value => {
      expect(toCountValue(value)).toBe(0)
    })
  })
})

describe('formatCount', () => {
  describe('grouping boundary', () => {
    it('leaves three digits ungrouped', () => {
      expect(formatCount(999)).toBe('999')
    })

    it('groups at four digits', () => {
      expect(formatCount(1000)).toBe('1,000')
    })

    it('groups the four-digit count the regenerate dialog can reach', () => {
      expect(formatCount(1234)).toBe('1,234')
    })

    it('groups a seven-digit count twice', () => {
      expect(formatCount(1234567)).toBe('1,234,567')
    })
  })

  it('renders nothing counted as 0', () => {
    expect(formatCount(0)).toBe('0')
  })

  describe('the values the clamp absorbs', () => {
    it.each([-1, -3, -1234])('renders %p as 0 with no sign of any kind', value => {
      const rendered = formatCount(value)

      expect(rendered).toBe('0')
      expect(rendered).not.toContain('-')
      expect(rendered).not.toContain('\u2212')
    })

    it.each([
      [0.4, '0'],
      [1.5, '2'],
      [1233.5, '1,234']
    ])('renders the fractional %p as %p', (value, expected) => {
      expect(formatCount(value)).toBe(expected)
    })

    it.each([NaN, Infinity, -Infinity])('renders %p as 0 rather than as a word', value => {
      expect(formatCount(value)).toBe('0')
    })
  })

  // The point of routing through formatWholeNumber: a count beside a grouped target figure must group by the
  // same rule, so neither screen can drift from the other.
  it.each(PARITY_VALUES)('groups %p exactly as the calorie formatter does', value => {
    expect(formatCount(value)).toBe(formatCalories(value))
  })
})

describe('formatMacroGrams', () => {
  it('suffixes grams without a space', () => {
    expect(formatMacroGrams(146)).toBe('146g')
  })

  it('renders the fat target as 65g', () => {
    expect(formatMacroGrams(65)).toBe('65g')
  })

  it('renders zero grams', () => {
    expect(formatMacroGrams(0)).toBe('0g')
  })

  it('rounds down below the half boundary', () => {
    expect(formatMacroGrams(64.4)).toBe('64g')
  })

  it('rounds up at the half boundary', () => {
    expect(formatMacroGrams(64.5)).toBe('65g')
  })

  it('rounds a fractional gram figure up, like the shipped MacroGramRow', () => {
    expect(formatMacroGrams(64.6)).toBe('65g')
  })

  it('does not group thousands, matching the shipped MacroGramRow', () => {
    expect(formatMacroGrams(1200)).toBe('1200g')
  })

  it('keeps NaN visible rather than guarding it', () => {
    expect(formatMacroGrams(NaN)).toBe('NaNg')
  })
})

describe('formatMacroPair', () => {
  describe('Figma legend rows', () => {
    it('renders the planned protein pair', () => {
      expect(formatMacroPair(142, 146)).toBe('142 / 146g')
    })

    it('renders the planned carbs pair', () => {
      expect(formatMacroPair(188, 194)).toBe('188 / 194g')
    })

    it('renders the planned fat pair', () => {
      expect(formatMacroPair(61, 65)).toBe('61 / 65g')
    })

    it('renders the swap preview protein pair', () => {
      expect(formatMacroPair(135, 146)).toBe('135 / 146g')
    })

    it('renders the swap preview carbs pair', () => {
      expect(formatMacroPair(179, 194)).toBe('179 / 194g')
    })

    it('renders the swap preview fat pair', () => {
      expect(formatMacroPair(59, 65)).toBe('59 / 65g')
    })
  })

  it('puts the gram suffix on the target only', () => {
    expect(formatMacroPair(142, 146)).not.toContain('142g')
  })

  it('separates the values with a space, slash, space', () => {
    expect(formatMacroPair(142, 146)).toContain(' / ')
  })

  it('rounds both sides independently', () => {
    expect(formatMacroPair(141.6, 146.4)).toBe('142 / 146g')
  })

  it('rounds the planned carbs pair down to whole grams', () => {
    expect(formatMacroPair(188.4, 194)).toBe('188 / 194g')
  })

  it('renders nothing consumed as 0', () => {
    expect(formatMacroPair(0, 146)).toBe('0 / 146g')
  })

  it('renders a zero actual against a zero target', () => {
    expect(formatMacroPair(0, 0)).toBe('0 / 0g')
  })

  it('does not clamp an actual above the target', () => {
    expect(formatMacroPair(200, 146)).toBe('200 / 146g')
  })

  it('leaves both sides ungrouped, matching the shipped gram format', () => {
    expect(formatMacroPair(1200, 1500)).toBe('1200 / 1500g')
  })
})

describe('formatSignedCalories', () => {
  it('renders the Figma negative delta with a true minus sign', () => {
    expect(formatSignedCalories(-70, 'cal')).toBe('\u221270 cal')
  })

  it('uses U+2212 and not an ASCII hyphen for a negative delta', () => {
    const rendered = formatSignedCalories(-70, CAL_SUFFIX)

    expect(rendered.codePointAt(0)).toBe(0x2212)
    expect(rendered).not.toContain('-')
  })

  it('renders a positive delta with a leading plus', () => {
    expect(formatSignedCalories(70, CAL_SUFFIX)).toBe(`+70 ${CAL_SUFFIX}`)
  })

  it('renders an exact zero delta without a sign', () => {
    expect(formatSignedCalories(0, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  // Math.round(-0.4) is -0 and (-0).toLocaleString('en-US') is '-0', so formatting before taking the
  // magnitude would render '-0 cal' here — a delta that rounds to zero carries no sign
  it('drops the sign for a negative delta that rounds to zero', () => {
    expect(formatSignedCalories(-0.4, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  it('renders a positive delta that rounds to zero without a sign', () => {
    expect(formatSignedCalories(0.4, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  // The magnitude is rounded before the sign is applied, so the half boundary rounds away from zero
  it('rounds the negative half boundary away from zero rather than up to an unsigned zero', () => {
    expect(formatSignedCalories(-0.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}1 ${CAL_SUFFIX}`)
  })

  it('rounds the positive half boundary up before signing', () => {
    expect(formatSignedCalories(0.5, CAL_SUFFIX)).toBe(`+1 ${CAL_SUFFIX}`)
  })

  it('rounds a negative half boundary on its magnitude, not toward positive infinity', () => {
    expect(formatSignedCalories(-69.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}70 ${CAL_SUFFIX}`)
  })

  it('rounds a small negative half boundary away from zero', () => {
    expect(formatSignedCalories(-2.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}3 ${CAL_SUFFIX}`)
  })

  it('gives a negative and a positive half boundary the same magnitude', () => {
    const negative = formatSignedCalories(-69.5, CAL_SUFFIX)
    const positive = formatSignedCalories(69.5, CAL_SUFFIX)

    expect(negative.slice(1)).toBe(positive.slice(1))
    expect(negative).toBe(`${MINUS_SIGN}70 ${CAL_SUFFIX}`)
    expect(positive).toBe(`+70 ${CAL_SUFFIX}`)
  })

  it('groups the magnitude of a four digit delta', () => {
    expect(formatSignedCalories(-1200, CAL_SUFFIX)).toBe(`${MINUS_SIGN}1,200 ${CAL_SUFFIX}`)
  })

  it('does not emit an ASCII hyphen for a grouped negative delta', () => {
    expect(formatSignedCalories(-1200, CAL_SUFFIX)).not.toContain('-')
  })

  it('renders the minus sign and the thousands separator together', () => {
    expect(formatSignedCalories(-1234, 'cal')).toBe('\u22121,234 cal')
  })

  it('renders a unit suffix of grams with the same spacing', () => {
    expect(formatSignedCalories(-15, 'g')).toBe('\u221215 g')
  })

  it('renders the injected unit suffix rather than a hardcoded one', () => {
    expect(formatSignedCalories(-70, 'kcal')).toBe(`${MINUS_SIGN}70 kcal`)
  })

  it('keeps NaN visible rather than guarding it', () => {
    expect(formatSignedCalories(NaN, CAL_SUFFIX)).toBe(`+NaN ${CAL_SUFFIX}`)
  })
})

// Detects the planner and diary formatters drifting apart: comparing against the shipped expression
// catches a locale, fraction-digit or abbreviation option added to one of them but not the other
describe('drift from the shipped diary calorie formatter', () => {
  it.each(PARITY_VALUES)('renders %p exactly as the shipped formatter does', value => {
    expect(formatCalories(value)).toBe(Math.round(value).toLocaleString('en-US'))
  })

  it('renders the figures a drifting implementation would break, as literals', () => {
    expect(formatCalories(1940)).toBe('1,940')
    expect(formatCalories(12345)).toBe('12,345')
    expect(formatCalories(610)).toBe('610')
  })
})

// Every pair below is a real (amount, unit) of a default portion in the shipped releases/v1 catalog: the 84
// distinct pairs the published data holds, grouped by the rule each one exercises. They are written out
// rather than read from the release file because a committed test states its own oracle.
describe('formatCatalogPortionText', () => {
  describe('fraction glyphs for the amount', () => {
    it.each([
      [0.25, '¼ cup'],
      [0.33, '⅓ cup'],
      [0.5, '½ cup'],
      [0.75, '¾ cup'],
      [1, '1 cup']
    ])('writes a %p amount with the glyph the app uses everywhere', (amount, expected) => {
      expect(formatCatalogPortionText(amount, 'cup')).toBe(expected)
    })

    it.each([
      [1.5, '1½ oz'],
      [2.5, '2½ oz'],
      [4.5, '4½ oz'],
      [7.5, '7½ oz'],
      [6.75, '6¾ fl oz'],
      [9.5, '9½ fl oz'],
      [1.33, '1⅓ tbsp']
    ])('writes %p as a mixed number', (amount, expected) => {
      const unit = expected.slice(expected.indexOf(' ') + 1)

      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // Snapping to the nearest quarter would misstate the portion by up to 25 % while its gram weight, and
    // so the macros shown beside it, stay pinned to the stored amount.
    it.each([
      [0.2, '0.2'],
      [0.16, '0.16'],
      [0.12, '0.12'],
      [0.08, '0.08']
    ])('leaves %p as a plain decimal rather than snapping it to a quarter', (amount, expected) => {
      expect(formatCatalogPortionText(amount, 'each')).toBe(expected)
      expect(formatCatalogPortionText(amount, 'cup')).toBe(`${expected} cup`)
    })

    it.each([
      [0.35, '0.35 oz'],
      [0.99, '0.99 oz'],
      [1.41, '1.41 oz'],
      [1.69, '1.69 oz'],
      [1.94, '1.94 oz'],
      [3.52, '3.52 oz'],
      [11.2, '11.2 fl oz'],
      [11.3, '11.3 fl oz']
    ])('writes the two-decimal amount %p unrounded', (amount, expected) => {
      const unit = expected.slice(expected.indexOf(' ') + 1)

      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    it('renders the amount exactly as the servings stepper and the ingredient list render it', () => {
      const amounts = [0.08, 0.25, 0.33, 0.5, 0.75, 1, 1.33, 3, 6.75, 11.3]

      amounts.forEach(amount => {
        expect(formatCatalogPortionText(amount, 'each')).toBe(formatServingsDisplay(amount))
      })
    })
  })

  describe('generic count units are suppressed', () => {
    it.each([
      [1, 'each', '1'],
      [2, 'each', '2'],
      [3, 'each', '3'],
      [4, 'each', '4'],
      [5, 'each', '5'],
      [6, 'each', '6'],
      [8, 'each', '8'],
      [10, 'each', '10'],
      [11, 'each', '11'],
      [12, 'each', '12'],
      [16, 'each', '16'],
      [0.25, 'each', '¼'],
      [0.33, 'each', '⅓'],
      [0.5, 'each', '½'],
      [0.2, 'each', '0.2'],
      [0.16, 'each', '0.16'],
      [0.12, 'each', '0.12'],
      [0.08, 'each', '0.08'],
      [1, 'whole', '1'],
      [1, 'piece', '1'],
      [0.5, 'piece', '½'],
      [2, 'pieces', '2'],
      [3, 'pieces', '3'],
      [5, 'pieces', '5'],
      [23, 'pieces', '23'],
      [26, 'pieces', '26']
    ])('renders %p %s as the amount alone', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // The fifth key the server suppresses; no shipped default portion uses it, and a row that did must not
    // start reading '2 count'.
    it('suppresses the count unit itself', () => {
      expect(formatCatalogPortionText(2, 'count')).toBe('2')
    })

    it.each(['Each', 'EACH', ' each ', 'Pieces'])('reads %p as the same generic count unit', unit => {
      expect(formatCatalogPortionText(10, unit)).toBe('10')
    })
  })

  describe('measurement abbreviations are never inflected', () => {
    it.each([
      [3, 'oz', '3 oz'],
      [1, 'oz', '1 oz'],
      [2, 'oz', '2 oz'],
      [4, 'oz', '4 oz'],
      [8, 'oz', '8 oz'],
      [0.5, 'oz', '½ oz'],
      [1, 'fl oz', '1 fl oz'],
      [4, 'fl oz', '4 fl oz'],
      [6, 'fl oz', '6 fl oz'],
      [8, 'fl oz', '8 fl oz'],
      [12, 'fl oz', '12 fl oz'],
      [16, 'fl oz', '16 fl oz'],
      [100, 'g', '100 g'],
      [240, 'ml', '240 ml'],
      [0.5, 'lb', '½ lb'],
      [1, 'tbsp', '1 tbsp'],
      [2, 'tbsp', '2 tbsp'],
      [3, 'tbsp', '3 tbsp'],
      [5, 'tbsp', '5 tbsp'],
      [1, 'tsp', '1 tsp'],
      [2, 'tsp', '2 tsp'],
      [4, 'tsp', '4 tsp'],
      [0.25, 'tsp', '¼ tsp']
    ])('passes %p %s through verbatim', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // The abbreviations the vocabulary allows but the shipped default portions do not currently use.
    it.each([
      [2, 'kg', '2 kg'],
      [500, 'mg', '500 mg'],
      [400, 'mcg', '400 mcg'],
      [2, 'l', '2 l'],
      [2, 'lbs', '2 lbs']
    ])('passes the unused abbreviation %p %s through verbatim too', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    it.each(['OZ', 'Fl Oz', 'fl  oz'])('recognises %p as an abbreviation whatever its case or spacing', unit => {
      expect(formatCatalogPortionText(3, unit)).toBe(`3 ${unit.trim().replace(/\s+/g, ' ')}`)
    })
  })

  describe('any other unit word agrees in number with the amount', () => {
    it.each([
      [1, 'cup', '1 cup'],
      [1, 'slice', '1 slice'],
      [0.5, 'slice', '½ slice'],
      [2, 'slices', '2 slices'],
      [3, 'slices', '3 slices'],
      [4, 'slices', '4 slices'],
      [10, 'slices', '10 slices'],
      [1, 'tablespoon', '1 tablespoon'],
      [2, 'tablespoons', '2 tablespoons'],
      [1, 'teaspoon', '1 teaspoon'],
      [1, 'clove', '1 clove'],
      [1, 'head', '1 head'],
      [0.2, 'head', '0.2 head'],
      [56, 'grams', '56 grams']
    ])('leaves %p %s alone, because it already agrees', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // The defect this formatter exists to remove: the catalog stores '2 tablespoon' and '60 milliliter'.
    it.each([
      [2, 'tablespoon', '2 tablespoons'],
      [60, 'milliliter', '60 milliliters']
    ])('pluralises the stored singular %p %s', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // No shipped default portion pairs 'cup' with an amount above 1, so the plural is covered here.
    it.each([
      [2, 'cup', '2 cups'],
      [3, 'cup', '3 cups'],
      [1.5, 'cup', '1½ cups'],
      [3, 'cups', '3 cups'],
      [2, 'clove', '2 cloves'],
      [2, 'head', '2 heads'],
      [2, 'liter', '2 liters'],
      [2, 'bunch', '2 bunches'],
      [2, 'slice', '2 slices'],
      [2, 'teaspoon', '2 teaspoons']
    ])('pluralises %p %s', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    // Bidirectional: a unit stored in the plural has to read singular when the amount calls for it.
    it.each([
      [1, 'cups', '1 cup'],
      [1, 'slices', '1 slice'],
      [0.5, 'slices', '½ slice'],
      [1, 'tablespoons', '1 tablespoon'],
      [1, 'grams', '1 gram'],
      [1, 'bunches', '1 bunch'],
      [0.25, 'cups', '¼ cup']
    ])('singularises the stored plural %p %s', (amount, unit, expected) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(expected)
    })

    it('treats anything above one as plural and one or less as singular', () => {
      expect(formatCatalogPortionText(1.01, 'cup')).toBe('1.01 cups')
      expect(formatCatalogPortionText(1, 'cup')).toBe('1 cup')
      expect(formatCatalogPortionText(0.75, 'cup')).toBe('¾ cup')
      expect(formatCatalogPortionText(0, 'cup')).toBe('0 cup')
    })

    // A singular that merely ends in -s must not be inflected a second time.
    it('leaves a singular -s word singular', () => {
      expect(formatCatalogPortionText(1, 'glass')).toBe('1 glass')
      expect(formatCatalogPortionText(2, 'glass')).toBe('2 glasses')
    })

    it('keeps the stored casing of a unit it inflects', () => {
      expect(formatCatalogPortionText(2, 'Cup')).toBe('2 Cups')
      expect(formatCatalogPortionText(2, 'CUP')).toBe('2 CUPS')
      expect(formatCatalogPortionText(1, 'Slices')).toBe('1 Slice')
    })

    // A unit that arrives qualified inflects the thing being counted, not the qualifier.
    it('inflects the head noun of a qualified unit', () => {
      expect(formatCatalogPortionText(2, 'cup, chopped')).toBe('2 cups, chopped')
      expect(formatCatalogPortionText(1, 'slices, halved')).toBe('1 slice, halved')
    })
  })

  describe('the join is the one the ingredient list uses', () => {
    it.each([
      [0.25, 'cup'],
      [0.5, 'cup'],
      [3, 'oz'],
      [100, 'g']
    ])('writes %p %s through the shared amount-and-unit template', (amount, unit) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(
        stringWithNamedParameters(MEAL_PLAN_UNIT_VALUE_TEMPLATE, {value: formatServingsDisplay(amount), unit})
      )
    })

    it.each([
      [0.25, 'cup'],
      [0.5, 'cup'],
      [0.75, 'cup'],
      [3, 'oz'],
      [1, 'slice']
    ])('agrees with the ingredient formatter for %p %s, which needs no inflection', (amount, unit) => {
      expect(formatCatalogPortionText(amount, unit)).toBe(
        formatIngredientQuantity({quantity: amount, unit}, WHOLE_RECIPE_FACTOR)
      )
    })
  })

  describe('degenerate input', () => {
    // Nothing truthful can be said about a portion whose amount is not a number, so the label says nothing
    // rather than '"NaN cup"': the row keeps the name and calories it can vouch for.
    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'renders no label at all for an amount of %p',
      amount => {
        expect(formatCatalogPortionText(amount, 'cup')).toBe('')
        expect(formatCatalogPortionText(amount, 'each')).toBe('')
        expect(formatCatalogPortionText(amount, null)).toBe('')
      }
    )

    it.each(['', '   ', '\t', null])('renders the amount alone for a unit of %p, with no trailing space', unit => {
      const text = formatCatalogPortionText(0.5, unit)

      expect(text).toBe('½')
      expect(text).toBe(text.trim())
    })

    it('trims and collapses the whitespace of a unit it keeps', () => {
      expect(formatCatalogPortionText(0.25, '  cup ')).toBe('¼ cup')
      expect(formatCatalogPortionText(1, 'fl  oz')).toBe('1 fl oz')
    })

    it('keeps a one-letter unit rather than erasing it', () => {
      expect(formatCatalogPortionText(1, 's')).toBe('1 s')
    })

    it('keeps a unit with no letters to inflect', () => {
      expect(formatCatalogPortionText(2, '%')).toBe('2 %')
    })

    it('renders no NaN or Infinity for any amount', () => {
      const amounts = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1, 1e21]

      amounts.forEach(amount => {
        const text = formatCatalogPortionText(amount, 'cup')

        expect(text).not.toContain('NaN')
        expect(text).not.toContain('Infinity')
      })
    })
  })
})

describe('isPlannerConfirmedTargets', () => {
  it('accepts a complete estimated or manual set', () => {
    expect(isPlannerConfirmedTargets(makeTargets())).toBe(true)
    expect(isPlannerConfirmedTargets(makeTargets({source: 'manual'}))).toBe(true)
  })

  it('accepts a stale set, since generation keeps using confirmed values until the user reconfirms', () => {
    expect(isPlannerConfirmedTargets(makeTargets({stale: true}))).toBe(true)
  })

  it('refuses a legacy set, an incomplete set and an absent one', () => {
    expect(isPlannerConfirmedTargets(makeTargets({source: 'legacy'}))).toBe(false)
    expect(isPlannerConfirmedTargets(makeTargets({complete: false}))).toBe(false)
    expect(isPlannerConfirmedTargets(null)).toBe(false)
  })

  it('refuses a source this build cannot read rather than assuming it is acceptable', () => {
    expect(isPlannerConfirmedTargets(makeTargets({source: null}))).toBe(false)
  })
})

describe('hasAnyTargetValue', () => {
  it('reports the figures the server holds, however few', () => {
    expect(hasAnyTargetValue(makeTargets())).toBe(true)
    expect(
      hasAnyTargetValue(
        makeTargets({targets: {calories: 1900, protein: null, carbs: null, fat: null}, complete: false})
      )
    ).toBe(true)
    expect(
      hasAnyTargetValue(makeTargets({targets: {calories: null, protein: 150, carbs: null, fat: null}, complete: false}))
    ).toBe(true)
  })

  it('reports none for an absent record and for one whose every column is unset', () => {
    expect(hasAnyTargetValue(null)).toBe(false)
    expect(hasAnyTargetValue(makeTargets({targets: null, complete: false, source: null}))).toBe(false)
    expect(
      hasAnyTargetValue(
        makeTargets({targets: {calories: null, protein: null, carbs: null, fat: null}, complete: false, source: null})
      )
    ).toBe(false)
  })
})

describe('confirmedTargetValues', () => {
  it('reads the four values of a planner-confirmed set', () => {
    expect(confirmedTargetValues(makeTargets())).toEqual({calories: 2100, protein: 150, carbs: 220, fat: 70})
    expect(confirmedTargetValues(makeTargets({stale: true}))).toEqual({
      calories: 2100,
      protein: 150,
      carbs: 220,
      fat: 70
    })
  })

  it('reads nothing from a set the planner refuses, so no editor treats it as already confirmed', () => {
    expect(confirmedTargetValues(makeTargets({source: 'legacy'}))).toBeNull()
    expect(confirmedTargetValues(makeTargets({source: null}))).toBeNull()
    expect(confirmedTargetValues(null)).toBeNull()
  })

  it('reads nothing when the record claims completeness but a value is missing', () => {
    expect(
      confirmedTargetValues(makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}}))
    ).toBeNull()
    expect(confirmedTargetValues(makeTargets({targets: null}))).toBeNull()
  })
})
