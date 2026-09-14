import {MacroTotals} from '@data/models/Macros'
import {MealSlot, RecipeIngredient} from '@data/models/Recipe'
import {SwapPreview} from '@data/models/SwapAlternative'

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
const DAY_KEY = '2025-07-05'
const DAY_TEXT = 'Sat Jul 5'
const KNOWN_SLOT: MealSlot = 'lunch'
const KNOWN_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const UNKNOWN_SLOT = 'brunch'
const PROTOTYPE_MEMBER_SLOTS = [
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
const WHOLE_RECIPE_DISPLAY_TEXT = '1 1/2 cups'

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

const makeDayTotals = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...DAY_TOTALS, ...overrides})

const makeNutrition = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({...MEAL_NUTRITION, ...overrides})

const makeTargets = (overrides: Partial<PreviewTargets> = {}): PreviewTargets => ({...TARGETS, ...overrides})

const replacingText = (slotLabel: string, dateText: string = DAY_TEXT): string =>
  SWAP_PREVIEW_REPLACING_TEMPLATE.replace('{slot}', slotLabel).replace('{date}', dateText)

const minutesText = (minutes: number): string =>
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE.replace('{minutes}', String(minutes))

const makeIngredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Chicken breast',
  quantity: 2,
  unit: 'cup',
  gramWeight: 480,
  displayText: WHOLE_RECIPE_DISPLAY_TEXT,
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

describe('deriveCalorieDelta', () => {
  describe('a swap that lowers the day', () => {
    it('signs the reduction with a true minus and the negative tone', () => {
      expect(deriveCalorieDelta(-70)).toEqual({text: `${MINUS_SIGN}70 ${CAL_LABEL}`, tone: 'negative'})
    })

    it('never draws an ASCII hyphen in the pill', () => {
      const delta = deriveCalorieDelta(-70)

      expect(delta?.text).toContain(MINUS_SIGN)
      expect(delta?.text).not.toContain('-')
    })

    it('groups a four-figure reduction behind the minus', () => {
      expect(deriveCalorieDelta(-1200)?.text).toBe(`${MINUS_SIGN}1,200 ${CAL_LABEL}`)
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

    it('reports a part-way day as its true fraction of the target', () => {
      expect(calorieProgressRatio(683, TARGET_CALORIES)).toBeCloseTo(683 / TARGET_CALORIES)
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

    it('pairs a zero target instead of reading it as unset', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({fat: 0}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190 / 210g', '58 / 0g'])
    })
  })

  describe('a target that never arrived as a usable number', () => {
    it('renders the actual alone instead of pairing it with an invented zero', () => {
      const [protein] = buildSwapMacroLegend(makeDayTotals(), makeTargets({protein: Number.NaN}))

      expect(protein).toEqual({key: 'protein', valueText: '135g'})
      expect(protein.valueText).not.toContain('/')
      expect(protein.valueText).not.toContain('0g')
      expect(protein.valueText).not.toContain('NaN')
    })

    it('degrades every row when no target is usable', () => {
      const targets = makeTargets({
        protein: Number.NaN,
        carbs: Number.POSITIVE_INFINITY,
        fat: Number.NEGATIVE_INFINITY
      })

      expect(buildSwapMacroLegend(makeDayTotals(), targets).map(item => item.valueText)).toEqual([
        '135g',
        '190g',
        '58g'
      ])
    })

    it('leaves the rows with a usable target paired', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({carbs: Number.NaN}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190g', '58 / 64g'])
    })

    it('never renders an infinity in place of a target', () => {
      const legend = buildSwapMacroLegend(makeDayTotals(), makeTargets({fat: Number.POSITIVE_INFINITY}))

      expect(legend.map(item => item.valueText)).toEqual(['135 / 146g', '190 / 210g', '58g'])
      expect(legend[2].valueText).not.toContain('Infinity')
    })
  })

  describe('purity', () => {
    it('leaves the totals and targets it was handed untouched', () => {
      const dayTotals = makeDayTotals()
      const targets = makeTargets()
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
      expect(formatReplacingContext(KNOWN_SLOT, DAY_KEY)).toBe('Replacing lunch · Sat Jul 5')
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
      PROTOTYPE_MEMBER_SLOTS.forEach(slot => {
        expect(formatReplacingContext(slot, DAY_KEY)).toBe(DAY_TEXT)
      })
    })

    it('never renders an inherited function in place of a slot label', () => {
      PROTOTYPE_MEMBER_SLOTS.forEach(slot => {
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
      // parseDayKey builds the date from the key's own parts, which keeps these expectations timezone-independent
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
  describe('a recipe that yields more than one serving', () => {
    it('halves the stored amount for one serving of a two-serving recipe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, 2)

      expect(rows).toEqual([{name: 'Chicken breast', quantityText: '5 oz', isOptional: false}])
    })

    it('applies the multiplier and the yield together when both differ from one', () => {
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

  describe('an ingredient counted rather than measured', () => {
    it('renders the scaled amount alone when the row carries no unit', () => {
      const rows = resolvePreviewIngredients([makeIngredient({name: 'Avocado', quantity: 2, unit: ''})], 1, 2)

      expect(rows[0].quantityText).toBe('1')
    })
  })

  describe('the amount the server pre-formatted', () => {
    it('is never rendered in place of the portion it does not describe', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 2, unit: 'cup'})], 1, 2)

      expect(rows[0].quantityText).toBe('1 cup')
      expect(rows[0].quantityText).not.toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('is the only amount left for a quantity that cannot be scaled', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: Number.NaN})], 1, 2)

      expect(rows[0].quantityText).toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('is trimmed when it stands in for an unscalable quantity', () => {
      const padded = `  ${WHOLE_RECIPE_DISPLAY_TEXT}  `
      const rows = resolvePreviewIngredients(
        [makeIngredient({quantity: Number.POSITIVE_INFINITY, displayText: padded})],
        1,
        2
      )

      expect(rows[0].quantityText).toBe(WHOLE_RECIPE_DISPLAY_TEXT)
    })

    it('leaves the amount empty rather than rendering NaN when neither is usable', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: Number.NaN, displayText: ''})], 1, 2)

      expect(rows[0].quantityText).toBe('')
    })
  })

  describe('a yield or multiplier that cannot divide', () => {
    it('falls back to the stored whole-recipe amount for a zero yield', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, 0)

      expect(rows[0].quantityText).toBe('10 oz')
    })

    it('falls back to the stored whole-recipe amount for a multiplier that never arrived as a number', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], Number.NaN, 2)

      expect(rows[0].quantityText).toBe('10 oz')
    })

    it('renders neither an infinity nor a NaN amount for a negative yield', () => {
      const rows = resolvePreviewIngredients([makeIngredient({quantity: 10, unit: 'oz'})], 1, -2)

      expect(rows[0].quantityText).toBe('10 oz')
      expect(rows[0].quantityText).not.toContain('Infinity')
      expect(rows[0].quantityText).not.toContain('NaN')
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

  describe('purity', () => {
    it('does not mutate the ingredients it was given', () => {
      const ingredients = [makeIngredient({quantity: 10, unit: 'oz'})]
      const snapshot = JSON.stringify(ingredients)

      resolvePreviewIngredients(ingredients, 1, 2)

      expect(JSON.stringify(ingredients)).toBe(snapshot)
    })
  })
})
