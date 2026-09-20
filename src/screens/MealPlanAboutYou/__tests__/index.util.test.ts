import {HeightUnitPref, SexForEstimate, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {WeighIn} from '@data/models/WeighIn'
import {WeightUnit} from '@data/models/WeightUnit'
import {KG_PER_LB, MAX_BODY_WEIGHT_KG, MIN_BODY_WEIGHT_KG} from '@utility/UnitConversionUtility'

import {
  ABOUT_YOU_FIELD_CONTRACTS,
  AboutYouErrors,
  AboutYouInitialInput,
  buildBodyStepValues,
  convertHeightFieldsToUnit,
  convertWeightFieldToUnit,
  initialFieldsFor,
  MealPlanAboutYouFields,
  mergeAboutYouFields,
  normalizeAboutYouFieldText,
  normalizeDecimalFieldText,
  normalizeIntegerFieldText,
  resolveWeighInPrefill,
  selectLatestWeighIn,
  suggestedWeightField,
  validateAboutYou,
  WIZARD_TOTAL_STEPS_ESTIMATED,
  WIZARD_TOTAL_STEPS_MANUAL,
  wizardTotalSteps
} from '../index.util'

// Derived rather than written as the 66-661 lb the copy quotes: 30 kg is 66.13867865546327 lb, so a
// rounded 66 would suggest 29.94 kg and the server would then refuse the weight. The probes straddle the
// derived edges by an offset because the edges themselves land on float error (30 / KG_PER_LB * KG_PER_LB
// reads as 29.999999999999996).
const MIN_SUPPORTED_POUNDS: number = MIN_BODY_WEIGHT_KG / KG_PER_LB

const MAX_SUPPORTED_POUNDS: number = MAX_BODY_WEIGHT_KG / KG_PER_LB

const POUND_PROBE_OFFSET: number = 0.01

const makeWeighIn = (overrides: Partial<WeighIn> = {}): WeighIn => ({
  id: 'weigh-in-1',
  weight: 182.2,
  loggedAt: '2026-07-03T08:00:00.000Z',
  ...overrides
})

const makeFields = (overrides: Partial<MealPlanAboutYouFields> = {}): MealPlanAboutYouFields => ({
  age: '34',
  feet: '5',
  inches: '10',
  centimeters: '177.8',
  weight: '182.2',
  ...overrides
})

const makeInitialInput = (overrides: Partial<AboutYouInitialInput> = {}): AboutYouInitialInput => ({
  savedAge: null,
  savedHeightCm: null,
  savedWeightKg: null,
  heightUnit: 'cm',
  weightUnit: 'kg',
  prefill: {value: '', unit: null, showCaption: false},
  ...overrides
})

const errorsFor = (
  overrides: Partial<MealPlanAboutYouFields>,
  heightUnit: HeightUnitPref,
  weightUnit: WeightUnitPref,
  sex: SexForEstimate | null = 'female'
): AboutYouErrors => validateAboutYou(makeFields(overrides), heightUnit, weightUnit, sex).errors

// The screen's change handler applied to every field at once, which is how entered text reaches the
// submit-time parsers: nothing validates raw keystrokes any more.
const asEntered = (entered: MealPlanAboutYouFields): MealPlanAboutYouFields => ({
  age: normalizeAboutYouFieldText('age', entered.age),
  feet: normalizeAboutYouFieldText('feet', entered.feet),
  inches: normalizeAboutYouFieldText('inches', entered.inches),
  centimeters: normalizeAboutYouFieldText('centimeters', entered.centimeters),
  weight: normalizeAboutYouFieldText('weight', entered.weight)
})

describe('selectLatestWeighIn', () => {
  it('returns null when the user has never weighed in', () => {
    expect(selectLatestWeighIn([])).toBeNull()
  })

  it('returns the only weigh-in when the history holds one entry', () => {
    const only = makeWeighIn({id: 'only'})

    expect(selectLatestWeighIn([only])).toBe(only)
  })

  it('selects the newest timestamp rather than the first or last array element', () => {
    const oldest = makeWeighIn({id: 'oldest', loggedAt: '2026-06-01T08:00:00.000Z', weight: 170})
    const middle = makeWeighIn({id: 'middle', loggedAt: '2026-06-20T08:00:00.000Z', weight: 175})
    const newest = makeWeighIn({id: 'newest', loggedAt: '2026-07-03T08:00:00.000Z', weight: 182.2})

    expect(selectLatestWeighIn([oldest, middle, newest])).toBe(newest)
    expect(selectLatestWeighIn([newest, middle, oldest])).toBe(newest)
    expect(selectLatestWeighIn([middle, newest, oldest])).toBe(newest)
  })

  it('breaks a shared timestamp on the greatest id, so either arrival order prefills the same weight', () => {
    const lowerId = makeWeighIn({id: 'weigh-in-a', weight: 182.2})
    const greaterId = makeWeighIn({id: 'weigh-in-b', weight: 170})

    expect(selectLatestWeighIn([lowerId, greaterId])).toBe(greaterId)
    expect(selectLatestWeighIn([greaterId, lowerId])).toBe(greaterId)
  })

  it('breaks the tie between the two newest entries without ever letting an older entry win on its id', () => {
    const older = makeWeighIn({id: 'weigh-in-c', loggedAt: '2026-06-01T08:00:00.000Z', weight: 170})
    const newestLowerId = makeWeighIn({id: 'weigh-in-a', loggedAt: '2026-07-03T08:00:00.000Z', weight: 182.2})
    const newestGreaterId = makeWeighIn({id: 'weigh-in-b', loggedAt: '2026-07-03T08:00:00.000Z', weight: 179})

    expect(selectLatestWeighIn([older, newestLowerId, newestGreaterId])).toBe(newestGreaterId)
    expect(selectLatestWeighIn([newestGreaterId, newestLowerId, older])).toBe(newestGreaterId)
    expect(selectLatestWeighIn([newestLowerId, older, newestGreaterId])).toBe(newestGreaterId)
  })

  it('never lets an unparsable timestamp beat a real one, whichever order they arrive in', () => {
    const malformed = makeWeighIn({id: 'malformed', loggedAt: 'not-a-date', weight: 400})
    const valid = makeWeighIn({id: 'valid', loggedAt: '2020-01-01T08:00:00.000Z', weight: 182.2})

    expect(selectLatestWeighIn([malformed, valid])).toBe(valid)
    expect(selectLatestWeighIn([valid, malformed])).toBe(valid)
  })

  it('returns the greatest id when every timestamp is unparsable, whichever order they arrive in', () => {
    const lowerId = makeWeighIn({id: 'weigh-in-a', loggedAt: ''})
    const greaterId = makeWeighIn({id: 'weigh-in-b', loggedAt: 'yesterday'})

    expect(selectLatestWeighIn([lowerId, greaterId])).toBe(greaterId)
    expect(selectLatestWeighIn([greaterId, lowerId])).toBe(greaterId)
  })

  it('leaves the query result in its original order instead of sorting it in place', () => {
    const oldest = makeWeighIn({id: 'oldest', loggedAt: '2026-06-01T08:00:00.000Z'})
    const newest = makeWeighIn({id: 'newest', loggedAt: '2026-07-03T08:00:00.000Z'})
    const weighIns = [oldest, newest]

    selectLatestWeighIn(weighIns)

    expect(weighIns).toHaveLength(2)
    expect(weighIns[0]).toBe(oldest)
    expect(weighIns[1]).toBe(newest)
  })
})

describe('resolveWeighInPrefill', () => {
  it('suggests nothing when there is no weigh-in to suggest', () => {
    expect(resolveWeighInPrefill(null, 'lbs')).toEqual({value: '', unit: null, showCaption: false})
    expect(resolveWeighInPrefill(null, 'kg')).toEqual({value: '', unit: null, showCaption: false})
    expect(resolveWeighInPrefill(null, 'st')).toEqual({value: '', unit: null, showCaption: false})
  })

  it('suggests a pounds reading inside the supported range with its caption', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: 182.2}), 'lbs')).toEqual({
      value: '182.2',
      unit: 'lb',
      showCaption: true
    })
  })

  it('suggests a kilogram reading inside the supported range with its caption', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: 82.6}), 'kg')).toEqual({
      value: '82.6',
      unit: 'kg',
      showCaption: true
    })
  })

  it('suppresses the suggestion for a stone user even when the number would pass as kilograms', () => {
    const weighIn = makeWeighIn({weight: 82.6})

    expect(resolveWeighInPrefill(weighIn, 'st')).toEqual({value: '', unit: null, showCaption: false})
    expect(resolveWeighInPrefill(weighIn, 'kg')).toEqual({value: '82.6', unit: 'kg', showCaption: true})
  })

  it('starts the field empty when the stored number falls outside the range read in the current unit', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: 60}), 'lbs')).toEqual({value: '', unit: null, showCaption: false})
    expect(resolveWeighInPrefill(makeWeighIn({weight: 700}), 'lbs')).toEqual({
      value: '',
      unit: null,
      showCaption: false
    })
    expect(resolveWeighInPrefill(makeWeighIn({weight: 29.9}), 'kg')).toEqual({
      value: '',
      unit: null,
      showCaption: false
    })
    expect(resolveWeighInPrefill(makeWeighIn({weight: 300.1}), 'kg')).toEqual({
      value: '',
      unit: null,
      showCaption: false
    })
  })

  it('gates the same stored number on the unit it is read in, not on the number alone', () => {
    const weighIn = makeWeighIn({weight: 60})

    expect(resolveWeighInPrefill(weighIn, 'lbs')).toEqual({value: '', unit: null, showCaption: false})
    expect(resolveWeighInPrefill(weighIn, 'kg')).toEqual({value: '60', unit: 'kg', showCaption: true})
  })

  describe('at the edges of the supported range', () => {
    it('suggests the exact kilogram bounds, so the window is inclusive at both ends', () => {
      expect(resolveWeighInPrefill(makeWeighIn({weight: MIN_BODY_WEIGHT_KG}), 'kg')).toEqual({
        value: '30',
        unit: 'kg',
        showCaption: true
      })
      expect(resolveWeighInPrefill(makeWeighIn({weight: MAX_BODY_WEIGHT_KG}), 'kg')).toEqual({
        value: '300',
        unit: 'kg',
        showCaption: true
      })
    })

    it('withholds a suggestion at 66 lb, which reads as 29.94 kg and falls under the kilogram floor', () => {
      expect(resolveWeighInPrefill(makeWeighIn({weight: 66}), 'lbs')).toEqual({
        value: '',
        unit: null,
        showCaption: false
      })
    })

    it('suggests the first pound reading that clears the derived floor', () => {
      expect(resolveWeighInPrefill(makeWeighIn({weight: 66.1}), 'lbs')).toEqual({
        value: '',
        unit: null,
        showCaption: false
      })
      expect(resolveWeighInPrefill(makeWeighIn({weight: 66.14}), 'lbs')).toEqual({
        value: '66.14',
        unit: 'lb',
        showCaption: true
      })
    })

    it('suggests the last pound reading that stays under the derived ceiling', () => {
      expect(resolveWeighInPrefill(makeWeighIn({weight: 661}), 'lbs')).toEqual({
        value: '661',
        unit: 'lb',
        showCaption: true
      })
      expect(resolveWeighInPrefill(makeWeighIn({weight: 661.4}), 'lbs')).toEqual({
        value: '',
        unit: null,
        showCaption: false
      })
      expect(resolveWeighInPrefill(makeWeighIn({weight: 662}), 'lbs')).toEqual({
        value: '',
        unit: null,
        showCaption: false
      })
    })

    it('turns on either side of the derived pound bounds rather than the rounded ones', () => {
      const belowFloor = makeWeighIn({weight: MIN_SUPPORTED_POUNDS - POUND_PROBE_OFFSET})
      const aboveFloor = makeWeighIn({weight: MIN_SUPPORTED_POUNDS + POUND_PROBE_OFFSET})
      const belowCeiling = makeWeighIn({weight: MAX_SUPPORTED_POUNDS - POUND_PROBE_OFFSET})
      const aboveCeiling = makeWeighIn({weight: MAX_SUPPORTED_POUNDS + POUND_PROBE_OFFSET})

      expect(resolveWeighInPrefill(belowFloor, 'lbs').showCaption).toBe(false)
      expect(resolveWeighInPrefill(aboveFloor, 'lbs').showCaption).toBe(true)
      expect(resolveWeighInPrefill(belowCeiling, 'lbs').showCaption).toBe(true)
      expect(resolveWeighInPrefill(aboveCeiling, 'lbs').showCaption).toBe(false)
    })
  })

  it('offers the raw stored number, neither rounded nor converted', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: 82.55}), 'kg').value).toBe('82.55')
    expect(resolveWeighInPrefill(makeWeighIn({weight: 180}), 'lbs').value).toBe('180')
    expect(resolveWeighInPrefill(makeWeighIn({weight: 182.2}), 'lbs').value).toBe('182.2')
  })

  // A number typed under an earlier unit (182 entered as lb, the unit since switched to kg) passes the
  // kilogram range check and is suggested as 182 kg: the residual risk sanctioned by AAP 0.1.4, where the
  // caption and the explicit Continue are the safeguards
  it('suggests a stored 182 to a kilogram user with the caption, the sanctioned residual risk', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: 182}), 'kg')).toEqual({
      value: '182',
      unit: 'kg',
      showCaption: true
    })
  })

  it('rejects a non-finite stored weight in every unit', () => {
    expect(resolveWeighInPrefill(makeWeighIn({weight: NaN}), 'lbs')).toEqual({
      value: '',
      unit: null,
      showCaption: false
    })
    expect(resolveWeighInPrefill(makeWeighIn({weight: Infinity}), 'kg')).toEqual({
      value: '',
      unit: null,
      showCaption: false
    })
  })

  it('never shows the caption without a value, so the copy cannot appear over an empty field', () => {
    const units: WeightUnit[] = ['lbs', 'kg', 'st']
    const weights = [0, -5, 29.9, 60, 66.14, 82.6, 182.2, 400, 700, NaN]

    units.forEach(unit =>
      weights.forEach(weight => {
        const prefill = resolveWeighInPrefill(makeWeighIn({weight}), unit)

        expect(prefill.showCaption).toBe(prefill.value !== '')
      })
    )
  })
})

describe('validateAboutYou', () => {
  it('accepts a complete imperial form', () => {
    const validation = validateAboutYou(makeFields(), 'ft_in', 'lb', 'female')

    expect(validation.errors).toEqual({age: null, feet: null, inches: null, centimeters: null, weight: null, sex: null})
    expect(validation.isValid).toBe(true)
  })

  it('accepts a complete metric form and ignores the unused feet and inches fields', () => {
    const validation = validateAboutYou(makeFields({feet: '', inches: '', weight: '82.6'}), 'cm', 'kg', 'male')

    expect(validation.errors).toEqual({age: null, feet: null, inches: null, centimeters: null, weight: null, sex: null})
    expect(validation.isValid).toBe(true)
  })

  describe('age', () => {
    it('asks for an age that was left blank', () => {
      expect(errorsFor({age: ''}, 'ft_in', 'lb').age).toBe('age_required')
      expect(errorsFor({age: '   '}, 'ft_in', 'lb').age).toBe('age_required')
    })

    it('accepts both ends of the supported adult range inclusively', () => {
      expect(errorsFor({age: '18'}, 'ft_in', 'lb').age).toBeNull()
      expect(errorsFor({age: '100'}, 'ft_in', 'lb').age).toBeNull()
    })

    it('rejects an age just outside either end', () => {
      expect(errorsFor({age: '17'}, 'ft_in', 'lb').age).toBe('age_range')
      expect(errorsFor({age: '101'}, 'ft_in', 'lb').age).toBe('age_range')
    })

    it('rejects a fractional or non-numeric age', () => {
      expect(errorsFor({age: '34.5'}, 'ft_in', 'lb').age).toBe('age_range')
      expect(errorsFor({age: '-34'}, 'ft_in', 'lb').age).toBe('age_range')
      expect(errorsFor({age: 'thirty'}, 'ft_in', 'lb').age).toBe('age_range')
      expect(errorsFor({age: '3e2'}, 'ft_in', 'lb').age).toBe('age_range')
    })

    it('accepts an age surrounded by whitespace', () => {
      expect(errorsFor({age: ' 34 '}, 'ft_in', 'lb').age).toBeNull()
    })
  })

  describe('height in feet and inches', () => {
    it('asks for feet that were left blank', () => {
      expect(errorsFor({feet: ''}, 'ft_in', 'lb').feet).toBe('feet_required')
    })

    it('reads a blank inches field as zero inches', () => {
      const errors = errorsFor({feet: '6', inches: ''}, 'ft_in', 'lb')

      expect(errors.feet).toBeNull()
      expect(errors.inches).toBeNull()
    })

    it('accepts both ends of the supported height range', () => {
      expect(errorsFor({feet: '4', inches: '0'}, 'ft_in', 'lb').feet).toBeNull()
      expect(errorsFor({feet: '8', inches: '2'}, 'ft_in', 'lb').feet).toBeNull()
    })

    it('rejects a height that converts to fewer than 120 cm or more than 250 cm', () => {
      expect(errorsFor({feet: '3', inches: '11'}, 'ft_in', 'lb').feet).toBe('feet_range')
      expect(errorsFor({feet: '8', inches: '3'}, 'ft_in', 'lb').feet).toBe('feet_range')
      expect(errorsFor({feet: '0', inches: '0'}, 'ft_in', 'lb').feet).toBe('feet_range')
    })

    it('rejects a non-numeric feet entry', () => {
      expect(errorsFor({feet: 'five'}, 'ft_in', 'lb').feet).toBe('feet_range')
      expect(errorsFor({feet: '5.5'}, 'ft_in', 'lb').feet).toBe('feet_range')
    })

    it('accepts eleven inches, the last reading that is not a whole extra foot', () => {
      const errors = errorsFor({feet: '5', inches: '11'}, 'ft_in', 'lb')

      expect(errors.inches).toBeNull()
      expect(errors.feet).toBeNull()
    })

    it('rejects an inches entry of twelve or more without also faulting the feet', () => {
      const errors = errorsFor({feet: '5', inches: '12'}, 'ft_in', 'lb')

      expect(errors.inches).toBe('inches_range')
      expect(errors.feet).toBeNull()
    })

    it('rejects a non-numeric inches entry', () => {
      expect(errorsFor({feet: '5', inches: 'ten'}, 'ft_in', 'lb').inches).toBe('inches_range')
      expect(errorsFor({feet: '5', inches: '-1'}, 'ft_in', 'lb').inches).toBe('inches_range')
    })

    it('faults the missing feet and the out-of-range inches together', () => {
      const errors = errorsFor({feet: '', inches: '13'}, 'ft_in', 'lb')

      expect(errors.feet).toBe('feet_required')
      expect(errors.inches).toBe('inches_range')
    })

    it('never raises a centimetre error on the imperial route', () => {
      expect(errorsFor({centimeters: ''}, 'ft_in', 'lb').centimeters).toBeNull()
      expect(errorsFor({centimeters: 'nonsense'}, 'ft_in', 'lb').centimeters).toBeNull()
    })
  })

  describe('height in centimetres', () => {
    it('asks for a height that was left blank', () => {
      expect(errorsFor({centimeters: ''}, 'cm', 'kg').centimeters).toBe('height_cm_required')
      expect(errorsFor({centimeters: '  '}, 'cm', 'kg').centimeters).toBe('height_cm_required')
    })

    it('accepts both ends of the supported height range inclusively', () => {
      expect(errorsFor({centimeters: '120'}, 'cm', 'kg').centimeters).toBeNull()
      expect(errorsFor({centimeters: '250'}, 'cm', 'kg').centimeters).toBeNull()
    })

    it('rejects a height just outside either end', () => {
      expect(errorsFor({centimeters: '119.9'}, 'cm', 'kg').centimeters).toBe('height_cm_range')
      expect(errorsFor({centimeters: '250.1'}, 'cm', 'kg').centimeters).toBe('height_cm_range')
    })

    it('rejects a non-numeric or negative height', () => {
      expect(errorsFor({centimeters: 'tall'}, 'cm', 'kg').centimeters).toBe('height_cm_range')
      expect(errorsFor({centimeters: '-177.8'}, 'cm', 'kg').centimeters).toBe('height_cm_range')
    })

    it('never raises a feet or inches error on the metric route', () => {
      const errors = errorsFor({feet: '99', inches: '99'}, 'cm', 'kg')

      expect(errors.feet).toBeNull()
      expect(errors.inches).toBeNull()
    })
  })

  describe('weight', () => {
    it('asks for a weight that was left blank', () => {
      expect(errorsFor({weight: ''}, 'cm', 'kg').weight).toBe('weight_required')
      expect(errorsFor({weight: ' '}, 'cm', 'lb').weight).toBe('weight_required')
    })

    it('accepts both ends of the supported kilogram range inclusively', () => {
      expect(errorsFor({weight: '30'}, 'cm', 'kg').weight).toBeNull()
      expect(errorsFor({weight: '300'}, 'cm', 'kg').weight).toBeNull()
    })

    it('rejects a kilogram weight just outside either end', () => {
      expect(errorsFor({weight: '29.9'}, 'cm', 'kg').weight).toBe('weight_range')
      expect(errorsFor({weight: '300.1'}, 'cm', 'kg').weight).toBe('weight_range')
    })

    it('rejects 66 lb, which is 29.94 kg, even though the copy rounds the floor to 66 lb', () => {
      expect(errorsFor({weight: '66'}, 'ft_in', 'lb').weight).toBe('weight_range')
    })

    it('gates a pound weight on the converted kilogram bounds', () => {
      expect(errorsFor({weight: '66.1'}, 'ft_in', 'lb').weight).toBe('weight_range')
      expect(errorsFor({weight: '66.14'}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: '66.2'}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: '661'}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: '661.3'}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: '661.4'}, 'ft_in', 'lb').weight).toBe('weight_range')
      expect(errorsFor({weight: '662'}, 'ft_in', 'lb').weight).toBe('weight_range')
    })

    it('faults a pound weight on either side of the derived bounds rather than the rounded ones', () => {
      const belowFloor = String(MIN_SUPPORTED_POUNDS - POUND_PROBE_OFFSET)
      const aboveFloor = String(MIN_SUPPORTED_POUNDS + POUND_PROBE_OFFSET)
      const belowCeiling = String(MAX_SUPPORTED_POUNDS - POUND_PROBE_OFFSET)
      const aboveCeiling = String(MAX_SUPPORTED_POUNDS + POUND_PROBE_OFFSET)

      expect(errorsFor({weight: belowFloor}, 'ft_in', 'lb').weight).toBe('weight_range')
      expect(errorsFor({weight: aboveFloor}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: belowCeiling}, 'ft_in', 'lb').weight).toBeNull()
      expect(errorsFor({weight: aboveCeiling}, 'ft_in', 'lb').weight).toBe('weight_range')
    })

    it('accepts the exact kilogram bounds it is handed as numbers', () => {
      expect(errorsFor({weight: String(MIN_BODY_WEIGHT_KG)}, 'cm', 'kg').weight).toBeNull()
      expect(errorsFor({weight: String(MAX_BODY_WEIGHT_KG)}, 'cm', 'kg').weight).toBeNull()
    })

    it('reads the same typed number against the selected unit', () => {
      expect(errorsFor({weight: '60'}, 'ft_in', 'lb').weight).toBe('weight_range')
      expect(errorsFor({weight: '60'}, 'cm', 'kg').weight).toBeNull()
    })

    it('accepts a leading decimal point but still applies the range', () => {
      expect(errorsFor({weight: '.5'}, 'cm', 'kg').weight).toBe('weight_range')
      expect(errorsFor({weight: '82.'}, 'cm', 'kg').weight).toBeNull()
    })

    it('rejects a non-numeric or negative weight', () => {
      expect(errorsFor({weight: 'heavy'}, 'cm', 'kg').weight).toBe('weight_range')
      expect(errorsFor({weight: '-82.6'}, 'cm', 'kg').weight).toBe('weight_range')
      expect(errorsFor({weight: '182,2'}, 'ft_in', 'lb').weight).toBe('weight_range')
    })
  })

  describe('sex used for the calorie estimate', () => {
    it('asks for a sex when no option card is selected', () => {
      const validation = validateAboutYou(makeFields(), 'ft_in', 'lb', null)

      expect(validation.errors.sex).toBe('sex_required')
      expect(validation.isValid).toBe(false)
    })

    it('accepts every answer, including prefer-not-to-say, which routes to manual targets', () => {
      const answers: SexForEstimate[] = ['female', 'male', 'prefer_not_to_say']

      answers.forEach(sex => {
        const validation = validateAboutYou(makeFields(), 'ft_in', 'lb', sex)

        expect(validation.errors.sex).toBeNull()
        expect(validation.isValid).toBe(true)
      })
    })
  })

  describe('validating on Continue', () => {
    it('reports an empty age and an empty feet field together in one result', () => {
      const validation = validateAboutYou(makeFields({age: '', feet: ''}), 'ft_in', 'lb', 'female')

      expect(validation.errors.age).toBe('age_required')
      expect(validation.errors.feet).toBe('feet_required')
      expect(validation.isValid).toBe(false)
    })

    it('leaves the controls that are fine free of errors while others fail', () => {
      const validation = validateAboutYou(makeFields({age: '', feet: ''}), 'ft_in', 'lb', 'female')

      expect(validation.errors.inches).toBeNull()
      expect(validation.errors.centimeters).toBeNull()
      expect(validation.errors.weight).toBeNull()
      expect(validation.errors.sex).toBeNull()
    })

    it('reports every offending control at once when nothing has been answered', () => {
      const empty = makeFields({age: '', feet: '', inches: '', centimeters: '', weight: ''})

      expect(validateAboutYou(empty, 'ft_in', 'lb', null).errors).toEqual({
        age: 'age_required',
        feet: 'feet_required',
        inches: null,
        centimeters: null,
        weight: 'weight_required',
        sex: 'sex_required'
      })
      expect(validateAboutYou(empty, 'cm', 'kg', null).errors).toEqual({
        age: 'age_required',
        feet: null,
        inches: null,
        centimeters: 'height_cm_required',
        weight: 'weight_required',
        sex: 'sex_required'
      })
    })

    it('is invalid whenever a single control is wrong', () => {
      expect(validateAboutYou(makeFields({age: '17'}), 'ft_in', 'lb', 'female').isValid).toBe(false)
      expect(validateAboutYou(makeFields({inches: '12'}), 'ft_in', 'lb', 'female').isValid).toBe(false)
      expect(validateAboutYou(makeFields({weight: '662'}), 'ft_in', 'lb', 'female').isValid).toBe(false)
      expect(validateAboutYou(makeFields({centimeters: '119.9'}), 'cm', 'kg', 'female').isValid).toBe(false)
    })
  })
})

describe('buildBodyStepValues', () => {
  it('composes feet and inches into centimetres and pounds into kilograms', () => {
    expect(buildBodyStepValues(makeFields(), 'ft_in', 'lb')).toEqual({
      age: 34,
      heightCm: 177.8,
      weightKg: 82.644529814
    })
  })

  it('converts the confirmed pound weight without rounding it for display', () => {
    const values = buildBodyStepValues(makeFields({weight: '182.2'}), 'ft_in', 'lb')

    expect(values?.weightKg).toBe(82.644529814)
    expect(values?.weightKg).not.toBe(82.6)
    expect(values?.weightKg).not.toBe(Math.round(82.644529814 * 10) / 10)
  })

  it('reads a blank inches field as zero inches', () => {
    expect(buildBodyStepValues(makeFields({feet: '6', inches: ''}), 'ft_in', 'lb')?.heightCm).toBe(182.88)
  })

  it('passes a metric height through untouched and ignores feet and inches', () => {
    expect(buildBodyStepValues(makeFields({feet: '9', inches: '9'}), 'cm', 'kg')).toEqual({
      age: 34,
      heightCm: 177.8,
      weightKg: 182.2
    })
  })

  it('leaves a kilogram weight unconverted', () => {
    expect(buildBodyStepValues(makeFields({weight: '82.6'}), 'cm', 'kg')?.weightKg).toBe(82.6)
  })

  it('accepts a fractional centimetre height', () => {
    expect(buildBodyStepValues(makeFields({centimeters: '180.5'}), 'cm', 'kg')?.heightCm).toBe(180.5)
  })

  it('returns null when the age is missing or fractional', () => {
    expect(buildBodyStepValues(makeFields({age: ''}), 'ft_in', 'lb')).toBeNull()
    expect(buildBodyStepValues(makeFields({age: '34.5'}), 'ft_in', 'lb')).toBeNull()
  })

  it('returns null when the height cannot be read in the selected unit', () => {
    expect(buildBodyStepValues(makeFields({feet: ''}), 'ft_in', 'lb')).toBeNull()
    expect(buildBodyStepValues(makeFields({feet: '5', inches: 'ten'}), 'ft_in', 'lb')).toBeNull()
    expect(buildBodyStepValues(makeFields({centimeters: ''}), 'cm', 'kg')).toBeNull()
  })

  it('returns null when the weight cannot be read', () => {
    expect(buildBodyStepValues(makeFields({weight: ''}), 'cm', 'kg')).toBeNull()
    expect(buildBodyStepValues(makeFields({weight: 'heavy'}), 'cm', 'kg')).toBeNull()
  })

  it('reads the entered fields without writing anything back to them', () => {
    const fields = makeFields()

    buildBodyStepValues(fields, 'ft_in', 'lb')

    expect(fields).toEqual(makeFields())
  })

  it('parses what the fields hold and leaves the range decision to validateAboutYou', () => {
    expect(buildBodyStepValues(makeFields({age: '5', centimeters: '1'}), 'cm', 'kg')).toEqual({
      age: 5,
      heightCm: 1,
      weightKg: 182.2
    })
  })
})

describe('wizardTotalSteps', () => {
  it('counts seven steps on the estimated-targets route', () => {
    expect(wizardTotalSteps('estimated')).toBe(WIZARD_TOTAL_STEPS_ESTIMATED)
    expect(wizardTotalSteps('estimated')).toBe(7)
  })

  it('counts six steps on the manual-targets route, which skips the estimate review', () => {
    expect(wizardTotalSteps('manual')).toBe(WIZARD_TOTAL_STEPS_MANUAL)
    expect(wizardTotalSteps('manual')).toBe(6)
  })

  it('counts seven steps before a route has been chosen', () => {
    expect(wizardTotalSteps(null)).toBe(WIZARD_TOTAL_STEPS_ESTIMATED)
    expect(wizardTotalSteps(null)).toBe(7)
  })
})

describe('initialFieldsFor', () => {
  it('opens every field empty for a first-time user with no suggestion', () => {
    expect(initialFieldsFor(makeInitialInput())).toEqual({
      age: '',
      feet: '',
      inches: '',
      centimeters: '',
      weight: ''
    })
  })

  it('uses the weigh-in suggestion only while no weight has been saved', () => {
    const fields = initialFieldsFor(makeInitialInput({prefill: {value: '182.2', unit: 'kg', showCaption: true}}))

    expect(fields.weight).toBe('182.2')
  })

  it('prefers a saved weight over the weigh-in suggestion', () => {
    const input = makeInitialInput({savedWeightKg: 82.6, prefill: {value: '182.2', unit: 'kg', showCaption: true}})

    expect(initialFieldsFor(input).weight).toBe('82.6')
  })

  it('converts a saved weight for a pounds user and leaves it alone for a kilogram user', () => {
    const imperial = initialFieldsFor(makeInitialInput({savedWeightKg: 82.6, weightUnit: 'lb'}))
    const metric = initialFieldsFor(makeInitialInput({savedWeightKg: 82.6, weightUnit: 'kg'}))

    expect(imperial.weight).toBe('182.1')
    expect(metric.weight).toBe('82.6')
  })

  it('rounds the weight it puts in the field to one decimal', () => {
    expect(initialFieldsFor(makeInitialInput({savedWeightKg: 82.64452})).weight).toBe('82.6')
    expect(initialFieldsFor(makeInitialInput({savedWeightKg: 80})).weight).toBe('80')
  })

  it('restores a saved age and keeps it as typed', () => {
    expect(initialFieldsFor(makeInitialInput({savedAge: 34})).age).toBe('34')
    expect(initialFieldsFor(makeInitialInput({savedAge: null})).age).toBe('')
  })

  it('splits a saved height into feet and inches for a ft-in user', () => {
    const fields = initialFieldsFor(makeInitialInput({savedHeightCm: 177.8, heightUnit: 'ft_in'}))

    expect(fields.feet).toBe('5')
    expect(fields.inches).toBe('10')
    expect(fields.centimeters).toBe('')
  })

  it('carries a rounded twelfth inch into the next foot rather than rendering five feet twelve', () => {
    const fields = initialFieldsFor(makeInitialInput({savedHeightCm: 182, heightUnit: 'ft_in'}))

    expect(fields.feet).toBe('6')
    expect(fields.inches).toBe('0')
  })

  it('leaves both imperial height fields empty when no height has been saved', () => {
    const fields = initialFieldsFor(makeInitialInput({savedHeightCm: null, heightUnit: 'ft_in'}))

    expect(fields.feet).toBe('')
    expect(fields.inches).toBe('')
    expect(fields.centimeters).toBe('')
  })

  it('fills the centimetre field for a cm user and leaves feet and inches empty', () => {
    const fields = initialFieldsFor(makeInitialInput({savedHeightCm: 177.75, heightUnit: 'cm'}))

    expect(fields.centimeters).toBe('177.8')
    expect(fields.feet).toBe('')
    expect(fields.inches).toBe('')
  })

  it('drops a trailing zero decimal from a whole-centimetre height', () => {
    expect(initialFieldsFor(makeInitialInput({savedHeightCm: 170})).centimeters).toBe('170')
  })

  it('returns fields a resumed user can continue from without re-entering anything', () => {
    const input = makeInitialInput({
      savedAge: 34,
      savedHeightCm: 177.8,
      savedWeightKg: 82.644529814,
      heightUnit: 'ft_in',
      weightUnit: 'lb',
      prefill: {value: '170', unit: 'lb', showCaption: true}
    })

    expect(initialFieldsFor(input)).toEqual({
      age: '34',
      feet: '5',
      inches: '10',
      centimeters: '',
      weight: '182.2'
    })
  })
})

describe('mergeAboutYouFields', () => {
  it('returns the saved fields unchanged when nothing has been entered', () => {
    const savedFields = makeFields()

    expect(mergeAboutYouFields(savedFields, {})).toEqual(savedFields)
  })

  it('replaces only the field that was entered', () => {
    const savedFields = makeFields({age: '', weight: '170'})

    expect(mergeAboutYouFields(savedFields, {age: '34'})).toEqual({
      age: '34',
      feet: '5',
      inches: '10',
      centimeters: '177.8',
      weight: '170'
    })
  })

  it('keeps the weigh-in suggestion in the weight field while another field is being answered', () => {
    const savedFields = initialFieldsFor(makeInitialInput({prefill: {value: '182.2', unit: 'kg', showCaption: true}}))

    expect(mergeAboutYouFields(savedFields, {age: '34', centimeters: '177.8'}).weight).toBe('182.2')
  })

  it('lets a weigh-in that arrives after another field was answered still reach the weight field', () => {
    const answered = {age: '34'}
    const beforeWeighIns = initialFieldsFor(makeInitialInput({prefill: {value: '', unit: null, showCaption: false}}))
    const afterWeighIns = initialFieldsFor(makeInitialInput({prefill: {value: '182.2', unit: 'kg', showCaption: true}}))

    expect(mergeAboutYouFields(beforeWeighIns, answered).weight).toBe('')
    expect(mergeAboutYouFields(afterWeighIns, answered).weight).toBe('182.2')
  })

  it('keeps a typed weight when the weigh-in suggestion changes underneath it', () => {
    const savedFields = initialFieldsFor(makeInitialInput({prefill: {value: '182.2', unit: 'kg', showCaption: true}}))

    expect(mergeAboutYouFields(savedFields, {weight: '176'}).weight).toBe('176')
  })

  it('treats an emptied field as an answer rather than falling back to the saved value', () => {
    expect(mergeAboutYouFields(makeFields(), {weight: ''}).weight).toBe('')
  })
})

describe('convertWeightFieldToUnit', () => {
  it('reads a pound weight as kilograms', () => {
    expect(convertWeightFieldToUnit('182.2', 'lb', 'kg')).toEqual({weight: '82.6'})
  })

  it('reads a kilogram weight as pounds', () => {
    expect(convertWeightFieldToUnit('82.6', 'kg', 'lb')).toEqual({weight: '182.1'})
  })

  it('returns the same measurement after a switch and a switch back', () => {
    const toKilograms = convertWeightFieldToUnit('182.2', 'lb', 'kg')
    const backToPounds = convertWeightFieldToUnit(toKilograms.weight ?? '', 'kg', 'lb')

    expect(backToPounds).toEqual({weight: '182.1'})
  })

  it('converts a whole number without a trailing decimal', () => {
    expect(convertWeightFieldToUnit('80', 'kg', 'lb')).toEqual({weight: '176.4'})
  })

  it('changes nothing when the unit has not changed', () => {
    expect(convertWeightFieldToUnit('182.2', 'lb', 'lb')).toEqual({})
  })

  it('changes nothing when the field is empty', () => {
    expect(convertWeightFieldToUnit('', 'lb', 'kg')).toEqual({})
    expect(convertWeightFieldToUnit('   ', 'lb', 'kg')).toEqual({})
  })

  it('changes nothing when the field holds no readable measurement', () => {
    expect(convertWeightFieldToUnit('abc', 'lb', 'kg')).toEqual({})
    expect(convertWeightFieldToUnit('1.2.3', 'lb', 'kg')).toEqual({})
    expect(convertWeightFieldToUnit('-5', 'lb', 'kg')).toEqual({})
  })

  it('carries a half-typed decimal across as the number it reads', () => {
    expect(convertWeightFieldToUnit('80.', 'kg', 'lb')).toEqual({weight: '176.4'})
  })
})

describe('convertHeightFieldsToUnit', () => {
  it('reads feet and inches as centimetres', () => {
    expect(convertHeightFieldsToUnit(makeFields({feet: '5', inches: '10'}), 'ft_in', 'cm')).toEqual({
      centimeters: '177.8'
    })
  })

  it('reads centimetres as feet and inches', () => {
    expect(convertHeightFieldsToUnit(makeFields({centimeters: '177.8'}), 'cm', 'ft_in')).toEqual({
      feet: '5',
      inches: '10'
    })
  })

  it('reads a foot count with no inches entered as that many whole feet', () => {
    expect(convertHeightFieldsToUnit(makeFields({feet: '5', inches: ''}), 'ft_in', 'cm')).toEqual({
      centimeters: '152.4'
    })
  })

  it('carries a whole number of feet without producing twelve inches', () => {
    expect(convertHeightFieldsToUnit(makeFields({centimeters: '182.9'}), 'cm', 'ft_in')).toEqual({
      feet: '6',
      inches: '0'
    })
  })

  it('changes nothing when the unit has not changed', () => {
    expect(convertHeightFieldsToUnit(makeFields(), 'cm', 'cm')).toEqual({})
    expect(convertHeightFieldsToUnit(makeFields(), 'ft_in', 'ft_in')).toEqual({})
  })

  it('changes nothing when the height being left behind is empty', () => {
    expect(convertHeightFieldsToUnit(makeFields({feet: '', inches: ''}), 'ft_in', 'cm')).toEqual({})
    expect(convertHeightFieldsToUnit(makeFields({centimeters: ''}), 'cm', 'ft_in')).toEqual({})
  })

  it('changes nothing when the height being left behind is unreadable', () => {
    expect(convertHeightFieldsToUnit(makeFields({feet: 'x'}), 'ft_in', 'cm')).toEqual({})
    expect(convertHeightFieldsToUnit(makeFields({centimeters: 'x'}), 'cm', 'ft_in')).toEqual({})
  })

  it("leaves the other unit's fields alone so the merge keeps reading the saved answer", () => {
    expect(convertHeightFieldsToUnit(makeFields(), 'ft_in', 'cm')).not.toHaveProperty('feet')
    expect(convertHeightFieldsToUnit(makeFields(), 'cm', 'ft_in')).not.toHaveProperty('centimeters')
  })
})

describe('a unit switch after a value was entered', () => {
  it('submits the weight the user gave rather than the same number relabelled', () => {
    const savedFields = initialFieldsFor(makeInitialInput({weightUnit: 'lb'}))
    const typed = mergeAboutYouFields(savedFields, {age: '34', centimeters: '177.8', weight: '182.2'})
    const converted = mergeAboutYouFields(typed, convertWeightFieldToUnit(typed.weight, 'lb', 'kg'))

    expect(buildBodyStepValues(converted, 'cm', 'kg')?.weightKg).toBeCloseTo(82.6, 1)
    expect(buildBodyStepValues(typed, 'cm', 'kg')?.weightKg).toBeCloseTo(182.2, 1)
  })

  it('submits the height the user gave rather than the same number under the other unit', () => {
    const typed = mergeAboutYouFields(makeFields(), {feet: '5', inches: '10'})
    const converted = mergeAboutYouFields(typed, convertHeightFieldsToUnit(typed, 'ft_in', 'cm'))

    expect(buildBodyStepValues(converted, 'cm', 'kg')?.heightCm).toBeCloseTo(177.8, 1)
  })
})

describe('suggestedWeightField', () => {
  it('leaves a suggestion alone when the field already shows the unit it was read in', () => {
    expect(suggestedWeightField({value: '182.2', unit: 'lb', showCaption: true}, 'lb')).toBe('182.2')
    expect(suggestedWeightField({value: '82.6', unit: 'kg', showCaption: true}, 'kg')).toBe('82.6')
  })

  it('expresses the same weight in the unit the field is showing', () => {
    expect(suggestedWeightField({value: '182.2', unit: 'lb', showCaption: true}, 'kg')).toBe('82.6')
    expect(suggestedWeightField({value: '82.6', unit: 'kg', showCaption: true}, 'lb')).toBe('182.1')
  })

  it('has nothing to express when no weigh-in was suggestible', () => {
    expect(suggestedWeightField({value: '', unit: null, showCaption: false}, 'kg')).toBe('')
    expect(suggestedWeightField({value: '', unit: null, showCaption: false}, 'lb')).toBe('')
  })
})

describe('a weigh-in that answers after the unit was switched', () => {
  // The sequence that relabels a weight if the suggestion is dropped in raw: nothing loaded, the user moves
  // the toggle, and the answer then arrives carrying the number as it was read under the old unit.
  it('submits the weight the user was shown, not the digits of the other unit', () => {
    const suggestion = resolveWeighInPrefill(makeWeighIn({weight: 182.2}), 'lbs')
    const afterSwitchToKg = initialFieldsFor(
      makeInitialInput({weightUnit: 'kg', heightUnit: 'cm', prefill: suggestion})
    )
    const answered = mergeAboutYouFields(afterSwitchToKg, {age: '34', centimeters: '177.8'})

    expect(answered.weight).toBe('82.6')
    expect(buildBodyStepValues(answered, 'cm', 'kg')?.weightKg).toBeCloseTo(82.6, 1)
  })

  it('shows nothing in the field until the answer arrives, and the right unit once it has', () => {
    const before = initialFieldsFor(
      makeInitialInput({weightUnit: 'kg', prefill: {value: '', unit: null, showCaption: false}})
    )
    const after = initialFieldsFor(
      makeInitialInput({weightUnit: 'kg', prefill: resolveWeighInPrefill(makeWeighIn({weight: 182.2}), 'lbs')})
    )

    expect(before.weight).toBe('')
    expect(after.weight).toBe('82.6')
  })

  it('lets a newer weigh-in replace an older suggestion after a unit switch, rather than freezing it', () => {
    // No override is written for a displayed suggestion, so the newer answer re-derives in the selected unit.
    const older = resolveWeighInPrefill(makeWeighIn({weight: 182.2}), 'lbs')
    const newer = resolveWeighInPrefill(makeWeighIn({weight: 176}), 'lbs')
    const afterOlder = initialFieldsFor(makeInitialInput({weightUnit: 'kg', prefill: older}))
    const afterNewer = initialFieldsFor(makeInitialInput({weightUnit: 'kg', prefill: newer}))

    expect(mergeAboutYouFields(afterOlder, {}).weight).toBe('82.6')
    expect(mergeAboutYouFields(afterNewer, {}).weight).toBe('79.8')
    expect(
      buildBodyStepValues(mergeAboutYouFields(afterNewer, {age: '34', centimeters: '177.8'}), 'cm', 'kg')?.weightKg
    ).toBeCloseTo(79.8, 1)
  })

  it('still carries a weight the user typed across a unit switch', () => {
    const typed = mergeAboutYouFields(makeFields(), {weight: '182.2'})
    const converted = mergeAboutYouFields(typed, convertWeightFieldToUnit(typed.weight, 'lb', 'kg'))

    expect(converted.weight).toBe('82.6')
    expect(
      buildBodyStepValues(mergeAboutYouFields(converted, {age: '34', centimeters: '177.8'}), 'cm', 'kg')?.weightKg
    ).toBeCloseTo(82.6, 1)
  })
})

describe('normalizeIntegerFieldText', () => {
  it('keeps nothing from text that carries no digit', () => {
    expect(normalizeIntegerFieldText('abc')).toBe('')
    expect(normalizeIntegerFieldText('x')).toBe('')
    expect(normalizeIntegerFieldText('   ')).toBe('')
    expect(normalizeIntegerFieldText('')).toBe('')
  })

  it('keeps the digits out of mixed text and drops the rest', () => {
    expect(normalizeIntegerFieldText('1a2')).toBe('12')
    expect(normalizeIntegerFieldText('-5')).toBe('5')
    expect(normalizeIntegerFieldText('-1')).toBe('1')
    expect(normalizeIntegerFieldText('3e2')).toBe('32')
  })

  it('drops a decimal point rather than the digits around it', () => {
    expect(normalizeIntegerFieldText('3.5')).toBe('35')
    expect(normalizeIntegerFieldText('82,6')).toBe('826')
  })

  it('keeps a leading zero, which is the only way a zero-led value can be typed', () => {
    expect(normalizeIntegerFieldText('007')).toBe('007')
    expect(normalizeIntegerFieldText('0')).toBe('0')
  })

  it('folds a locale digit to the ASCII digit it means', () => {
    expect(normalizeIntegerFieldText('\u0664\u0665')).toBe('45')
    expect(normalizeIntegerFieldText('\u06f4\u06f5')).toBe('45')
    expect(normalizeIntegerFieldText('\u0967\u096e')).toBe('18')
    expect(normalizeIntegerFieldText('\u09ea\u09eb')).toBe('45')
    expect(normalizeIntegerFieldText('\u0e54\u0e55')).toBe('45')
    expect(normalizeIntegerFieldText('\u17e4\u17e5')).toBe('45')
    expect(normalizeIntegerFieldText('\uff14\uff15')).toBe('45')
  })

  it('iterates code points, so an astral character cannot leave half of itself in the field', () => {
    const normalized = normalizeIntegerFieldText('3\u{1f600}4')

    expect(normalizeIntegerFieldText('3\u{1f600}')).toBe('3')
    expect(normalized).toBe('34')
    expect(Array.from(normalized)).toHaveLength(2)
    expect(normalized).not.toContain('\ud83d')
    expect(normalized).not.toContain('\ude00')
  })

  it('never returns more characters than it was given, so a field cannot outgrow its maxLength', () => {
    const payloads = ['abc', '1a2', '-5', '3.5', '\u0664\u0665', '3\u{1f600}', '   ', '007', '\uff14\uff15']

    payloads.forEach(payload => {
      expect(normalizeIntegerFieldText(payload).length).toBeLessThanOrEqual(payload.length)
    })
  })

  it('lets a whole number be typed one keystroke at a time', () => {
    expect(['3', '34'].map(normalizeIntegerFieldText)).toEqual(['3', '34'])
    expect(['1', '10', '100'].map(normalizeIntegerFieldText)).toEqual(['1', '10', '100'])
  })

  it('leaves already normalised text exactly as it is', () => {
    const payloads = ['', '0', '34', '007', '100']

    payloads.forEach(payload => {
      expect(normalizeIntegerFieldText(payload)).toBe(payload)
      expect(normalizeIntegerFieldText(normalizeIntegerFieldText(payload))).toBe(normalizeIntegerFieldText(payload))
    })
  })
})

describe('normalizeDecimalFieldText', () => {
  it('reads a comma as the decimal separator it is on a European layout', () => {
    expect(normalizeDecimalFieldText('82,6')).toBe('82.6')
    expect(normalizeDecimalFieldText('177,8')).toBe('177.8')
  })

  it('reads the Arabic decimal separator the Arabic-Indic digits arrive with', () => {
    expect(normalizeDecimalFieldText('\u0661\u0668\u066b\u0665')).toBe('18.5')
  })

  it('folds locale digits around an ASCII point', () => {
    expect(normalizeDecimalFieldText('\u0661\u0668.\u0665')).toBe('18.5')
    expect(normalizeDecimalFieldText('\uff18\uff12.\uff16')).toBe('82.6')
  })

  it('keeps the first separator and drops every later one, rather than the digits', () => {
    expect(normalizeDecimalFieldText('8.2.6')).toBe('8.26')
    expect(normalizeDecimalFieldText('1,2,3')).toBe('1.23')
    expect(normalizeDecimalFieldText('82,6.4')).toBe('82.64')
  })

  it('keeps a leading separator, which the submit-time parser accepts as a fraction', () => {
    expect(normalizeDecimalFieldText('.5')).toBe('.5')
    expect(normalizeDecimalFieldText(',5')).toBe('.5')
  })

  it('keeps a leading zero, without which 0.5 could not be typed', () => {
    expect(normalizeDecimalFieldText('007')).toBe('007')
    expect(normalizeDecimalFieldText('0.5')).toBe('0.5')
  })

  it('keeps nothing from text carrying neither a digit nor a separator', () => {
    expect(normalizeDecimalFieldText('abc')).toBe('')
    expect(normalizeDecimalFieldText('   ')).toBe('')
    expect(normalizeDecimalFieldText('')).toBe('')
  })

  it('drops a sign, a letter and an astral character without splitting it', () => {
    expect(normalizeDecimalFieldText('-82.6')).toBe('82.6')
    expect(normalizeDecimalFieldText('8a2.6')).toBe('82.6')
    expect(normalizeDecimalFieldText('82.6\u{1f600}')).toBe('82.6')
    expect(normalizeDecimalFieldText('8\u{1f600}2,6')).not.toContain('\ud83d')
  })

  it('never returns more characters than it was given, so a field cannot outgrow its maxLength', () => {
    const payloads = ['abc', '82,6', '8.2.6', '   ', '.5', '\u0661\u0668\u066b\u0665', '82.6\u{1f600}']

    payloads.forEach(payload => {
      expect(normalizeDecimalFieldText(payload).length).toBeLessThanOrEqual(payload.length)
    })
  })

  // Each keystroke re-enters the whole field, so a state the number pad passes through on its way to 82.6
  // has to survive normalisation or the separator can never be typed.
  it('lets a decimal be typed one keystroke at a time', () => {
    expect(['8', '82', '82.', '82.6'].map(normalizeDecimalFieldText)).toEqual(['8', '82', '82.', '82.6'])
    expect(['0', '0.', '0.5'].map(normalizeDecimalFieldText)).toEqual(['0', '0.', '0.5'])
    expect(['.', '.5'].map(normalizeDecimalFieldText)).toEqual(['.', '.5'])
  })

  it('leaves already normalised text exactly as it is', () => {
    const payloads = ['', '0.5', '.5', '007', '182.2', '82.6', '82.']

    payloads.forEach(payload => {
      expect(normalizeDecimalFieldText(payload)).toBe(payload)
      expect(normalizeDecimalFieldText(normalizeDecimalFieldText(payload))).toBe(normalizeDecimalFieldText(payload))
    })
  })
})

describe('normalizeAboutYouFieldText', () => {
  it('gives each field the contract its keyboard offers', () => {
    expect(ABOUT_YOU_FIELD_CONTRACTS).toEqual({
      age: 'integer',
      feet: 'integer',
      inches: 'integer',
      centimeters: 'decimal',
      weight: 'decimal'
    })
  })

  it('reads a separator as a separator only in the fields that measure', () => {
    expect(normalizeAboutYouFieldText('age', '3.5')).toBe('35')
    expect(normalizeAboutYouFieldText('feet', '5,5')).toBe('55')
    expect(normalizeAboutYouFieldText('inches', '1.5')).toBe('15')
    expect(normalizeAboutYouFieldText('centimeters', '177,8')).toBe('177.8')
    expect(normalizeAboutYouFieldText('weight', '82,6')).toBe('82.6')
  })

  it('applies the same digit folding and character rejection to every field', () => {
    expect(normalizeAboutYouFieldText('age', '\u0664\u0665')).toBe('45')
    expect(normalizeAboutYouFieldText('age', 'abc')).toBe('')
    expect(normalizeAboutYouFieldText('feet', 'x')).toBe('')
    expect(normalizeAboutYouFieldText('inches', '-1')).toBe('1')
    expect(normalizeAboutYouFieldText('centimeters', 'abc')).toBe('')
    expect(normalizeAboutYouFieldText('weight', '   ')).toBe('')
    expect(normalizeAboutYouFieldText('weight', '3\u{1f600}')).toBe('3')
  })
})

describe('what a field accepts at entry and what the step accepts on Continue', () => {
  it('accepts an imperial form typed entirely in Arabic-Indic digits', () => {
    const fields = asEntered(
      makeFields({age: '\u0663\u0664', feet: '\u0665', inches: '\u0661\u0660', weight: '\u0661\u0668\u0662,\u0662'})
    )

    expect(fields).toEqual({age: '34', feet: '5', inches: '10', centimeters: '177.8', weight: '182.2'})
    expect(validateAboutYou(fields, 'ft_in', 'lb', 'female').isValid).toBe(true)
    expect(buildBodyStepValues(fields, 'ft_in', 'lb')).toEqual({age: 34, heightCm: 177.8, weightKg: 82.644529814})
  })

  it('accepts a metric form whose measurements were typed with commas', () => {
    const fields = asEntered(makeFields({age: '34', feet: '', inches: '', centimeters: '177,8', weight: '82,6'}))

    expect(fields.centimeters).toBe('177.8')
    expect(fields.weight).toBe('82.6')
    expect(validateAboutYou(fields, 'cm', 'kg', 'male').isValid).toBe(true)
    expect(buildBodyStepValues(fields, 'cm', 'kg')).toEqual({age: 34, heightCm: 177.8, weightKg: 82.6})
  })

  it('accepts a fullwidth age and a Devanagari foot count', () => {
    const fields = asEntered(makeFields({age: '\uff13\uff14', feet: '\u096b', inches: '\u0967\u0966'}))

    expect(fields.age).toBe('34')
    expect(fields.feet).toBe('5')
    expect(fields.inches).toBe('10')
    expect(validateAboutYou(fields, 'ft_in', 'lb', 'female').isValid).toBe(true)
  })

  it('leaves a field that normalised away empty, which the step reports as the missing answer it is', () => {
    const fields = asEntered(makeFields({age: 'abc', weight: '   '}))

    expect(fields.age).toBe('')
    expect(fields.weight).toBe('')
    expect(errorsFor(fields, 'ft_in', 'lb').age).toBe('age_required')
    expect(errorsFor(fields, 'ft_in', 'lb').weight).toBe('weight_required')
    expect(buildBodyStepValues(fields, 'ft_in', 'lb')).toBeNull()
  })

  it('keeps every entered value on screen when the step refuses it, per the 03b note', () => {
    const fields = asEntered(makeFields({age: '5', feet: '1', inches: '-1', weight: '-8,5'}))

    expect(fields).toEqual({age: '5', feet: '1', inches: '1', centimeters: '177.8', weight: '8.5'})

    const validation = validateAboutYou(fields, 'ft_in', 'lb', 'female')

    expect(validation.isValid).toBe(false)
    expect(validation.errors.age).toBe('age_range')
    expect(validation.errors.feet).toBe('feet_range')
    expect(validation.errors.weight).toBe('weight_range')
    expect(fields).toEqual(asEntered(fields))
  })

  it('carries a normalised weight through a unit switch unchanged', () => {
    const entered = asEntered(makeFields({weight: '\u0661\u0668\u0662,\u0662'}))
    const converted = mergeAboutYouFields(entered, convertWeightFieldToUnit(entered.weight, 'lb', 'kg'))

    expect(entered.weight).toBe('182.2')
    expect(converted.weight).toBe('82.6')
  })
})
