import {MacroTotals} from '@data/models/Macros'
import {RecipeIngredient} from '@data/models/Recipe'
import {SwapPreview} from '@data/models/SwapAlternative'
import {plannedPortionFactor, scaleIngredientsForDisplay} from '@utility/RecipeIngredientUtility'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_SLOT_SENTENCE_LABELS,
  PROTEIN_LABEL,
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
  resolvePreviewIngredients
} from '../index.util'

const MINUS_SIGN = '\u2212'
const TARGET_CALORIES = 2100
const DAY_KEY = '2026-07-05'
const DAY_TEXT = 'Sun Jul 5'
const KNOWN_SLOT = 'lunch'
const KNOWN_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']
const UNKNOWN_SLOT = 'brunch'

// Slot codes that name a member of Object.prototype: an index lookup on a plain object literal resolves several of
// these to inherited functions, so they are the unknown codes most likely to reach the pill as malformed copy
const PROTOTYPE_SLOTS = [
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

type TargetOverrides = Partial<Record<keyof MacroTotals, number | null>>

const makeDayTotals = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...DAY_TOTALS, ...overrides})

const makeNutrition = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...MEAL_NUTRITION, ...overrides})

// Cast so the nullable fixture compiles whether `SwapPreview['targets']` stays `MacroTargets` or is narrowed
// to `MacroTotals` — the util's own guard is what the degrade tests exercise, not the model's nullability
const makeTargets = (overrides: TargetOverrides = {}): PreviewTargets => ({...TARGETS, ...overrides}) as PreviewTargets

const replacingText = (slotLabel: string, dateText: string = DAY_TEXT): string =>
  SWAP_PREVIEW_REPLACING_TEMPLATE.replace('{slot}', slotLabel).replace('{date}', dateText)

const minutesText = (minutes: number): string =>
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE.replace('{minutes}', String(minutes))

// The stored row as the server sends it: WHOLE-RECIPE amounts, which is what makes the scaling below the point
// of the suite. `displayText` deliberately disagrees with `quantity` so a regression that renders the stored
// text instead of the portion's amount is visible rather than coincidentally right.
const makeIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Chicken breast',
  quantity: 2,
  unit: 'cup',
  gramWeight: 480,
  displayText: '1 1/2 cups',
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

describe('deriveCalorieDelta', () => {
  describe('a swap that lowers the day', () => {
    it('signs the reduction with a true minus and the negative tone', () => {
      expect(deriveCalorieDelta(-240)).toEqual({text: `${MINUS_SIGN}240 ${CAL_LABEL}`, tone: 'negative'})
    })

    it('never draws an ASCII hyphen in the pill', () => {
      const delta = deriveCalorieDelta(-240)

      expect(delta?.text).toContain(MINUS_SIGN)
      expect(delta?.text).not.toContain('-')
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
  })

  describe('a target the server left unset', () => {
    it('renders the actual alone instead of pairing it with an invented zero', () => {
      const [protein] = buildSwapMacroLegend(makeDayTotals(), makeTargets({protein: null}))

      expect(protein).toEqual({key: 'protein', valueText: '135g'})
      expect(protein.valueText).not.toContain('/')
      expect(protein.valueText).not.toContain('0g')
      expect(protein.valueText).not.toContain('null')
    })

    it('degrades every row when no target arrived at all', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({protein: null, carbs: null, fat: null}))

      expect(legend.map(item => item.valueText)).toEqual(['135g', '190g', '58g'])
    })

    it('leaves the rows with a target paired', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({carbs: null}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190g', '58 / 64g'])
    })

    it('degrades a target that arrived as a non-finite number', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({fat: Number.NaN}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190 / 210g', '58g'])
    })
  })

  describe('purity', () => {
    it('leaves the totals and targets it was handed untouched', () => {
      const dayTotals = makeDayTotals()
      const targets = makeTargets({carbs: null})
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
      expect(formatReplacingContext(KNOWN_SLOT, DAY_KEY)).toBe('Replacing lunch · Sun Jul 5')
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
      PROTOTYPE_SLOTS.forEach(slot => {
        expect(formatReplacingContext(slot, DAY_KEY)).toBe(DAY_TEXT)
      })
    })

    it('never renders an inherited function in place of a slot label', () => {
      PROTOTYPE_SLOTS.forEach(slot => {
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
  // The contract this screen gets wrong if nobody pins it: `alternative.nutrition` is the PORTION's, while
  // `alternative.recipe.ingredients` are the WHOLE RECIPE's, so the amounts have to be scaled by the same two
  // numbers the server scaled the nutrition by — `portionMultiplier / yieldServings`. Rendering the stored
  // `displayText` instead is what put whole-recipe ingredients beside a portion's calories on frame 13b.
  describe('a recipe that yields more than one serving', () => {
    it('halves the stored amount for one serving of a two-serving recipe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, 2)

      expect(rows).toEqual([{name: 'Chicken breast', quantityText: '5 oz', isOptional: false}])
    })

    it('applies the multiplier and the yield together when both differ from one', () => {
      // 6 cups in the whole recipe / 4 servings x 1.5 portions = 2.25 cups
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

  describe('the amount the server pre-formatted', () => {
    it('is never rendered in place of the portion it does not describe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 2, unit: 'cup'})], 1, 2)

      // '1 1/2 cups' is the whole recipe's text on the fixture; the portion is one cup
      expect(rows[0].quantityText).toBe('1 cup')
      expect(rows[0].quantityText).not.toBe('1 1/2 cups')
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

      expect(rows).toEqual([
        {name: 'Tortilla, whole wheat', quantityText: '1', isOptional: false},
        {name: 'Turkey breast, sliced', quantityText: '4 oz', isOptional: false},
        {name: 'Hummus', quantityText: '2 tbsp', isOptional: true}
      ])
    })

    it('returns an empty list for a recipe with no ingredients rather than throwing', () => {
      expect(resolvePreviewIngredients([], 1, 2)).toEqual([])
    })
  })

  describe('the shared rule', () => {
    it('adds no transformation of its own to the scaling both screens share', () => {
      // Pins the delegation rather than the arithmetic: the screen must apply the shared factor and nothing
      // else, which is what stops the preview and recipe detail drifting apart again
      const ingredients = [
        makeIngredient({quantity: 6, unit: 'cup'}),
        makeIngredient({name: 'Avocado', quantity: 3, unit: ''})
      ]

      expect(resolvePreviewIngredients(ingredients, 1.5, 4)).toEqual(
        scaleIngredientsForDisplay(ingredients, plannedPortionFactor(1.5, 4))
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
