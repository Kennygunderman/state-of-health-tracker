import {HeightUnitPref, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {WEIGHT_UNITS} from '@data/models/WeightUnit'

import {
  centimetersToFeetInches,
  CM_PER_INCH,
  feetInchesToCentimeters,
  formatHeightImperial,
  heightUnitPrefFor,
  INCHES_PER_FOOT,
  isSupportedBodyWeightInUnit,
  isSupportedBodyWeightKg,
  KG_PER_LB,
  KG_PER_STONE,
  kilogramsToPounds,
  MAX_BODY_WEIGHT_KG,
  MIN_BODY_WEIGHT_KG,
  poundsToKilograms,
  stoneToKilograms,
  weightUnitPrefFor
} from '../UnitConversionUtility'

describe('conversion constants', () => {
  it('pins the pound, inch and stone factors to their exact international definitions', () => {
    expect(KG_PER_LB).toBe(0.45359237)
    expect(CM_PER_INCH).toBe(2.54)
    expect(KG_PER_STONE).toBe(6.35029318)
    expect(INCHES_PER_FOOT).toBe(12)
  })

  it('pins the body-weight envelope to the kilogram range the server validates', () => {
    expect(MIN_BODY_WEIGHT_KG).toBe(30)
    expect(MAX_BODY_WEIGHT_KG).toBe(300)
  })
})

describe('poundsToKilograms', () => {
  it('converts a pound reading to kilograms', () => {
    expect(poundsToKilograms(182.2)).toBeCloseTo(82.644529814, 9)
  })

  it('converts zero pounds to zero kilograms', () => {
    expect(poundsToKilograms(0)).toBe(0)
  })

  it('leaves rounding to the screens that render the value', () => {
    const kilograms = poundsToKilograms(182.2)

    expect(kilograms).not.toBe(Math.round(kilograms))
    expect(kilograms).toBeGreaterThan(82.6)
    expect(kilograms).toBeLessThan(82.7)
  })

  it('preserves the sign of a negative reading rather than clamping it', () => {
    expect(poundsToKilograms(-10)).toBeCloseTo(-4.5359237, 7)
  })

  it('propagates a non-numeric reading instead of fabricating a weight', () => {
    expect(poundsToKilograms(NaN)).toBeNaN()
    expect(poundsToKilograms(Infinity)).toBe(Infinity)
  })
})

describe('kilogramsToPounds', () => {
  it('converts a stored metric weight back to pounds for display', () => {
    expect(kilogramsToPounds(82.6)).toBeCloseTo(182.1018285647, 9)
  })

  it('returns the original pounds after a round trip through kilograms', () => {
    expect(kilogramsToPounds(poundsToKilograms(182.2))).toBeCloseTo(182.2, 10)
  })

  it('converts zero kilograms to zero pounds', () => {
    expect(kilogramsToPounds(0)).toBe(0)
  })
})

describe('stoneToKilograms', () => {
  it('interprets a stone reading one way only, since no screen renders stone back', () => {
    expect(stoneToKilograms(13)).toBeCloseTo(82.55381134, 8)
  })

  it('converts zero stone to zero kilograms', () => {
    expect(stoneToKilograms(0)).toBe(0)
  })
})

describe('feetInchesToCentimeters', () => {
  it('converts feet and inches to an exact centimetre value', () => {
    expect(feetInchesToCentimeters(5, 10)).toBe(177.8)
    expect(feetInchesToCentimeters(6, 0)).toBe(182.88)
    expect(feetInchesToCentimeters(0, 1)).toBe(2.54)
  })

  it('converts a zero height to zero centimetres', () => {
    expect(feetInchesToCentimeters(0, 0)).toBe(0)
  })
})

describe('centimetersToFeetInches', () => {
  it('splits a centimetre height into whole feet and inches', () => {
    expect(centimetersToFeetInches(177.8)).toEqual({feet: 5, inches: 10})
  })

  // 182cm is 71.6535in: splitting first leaves 5ft and 11.65in, and rounding that remainder produces
  // the impossible 5'12" instead of carrying into the next foot
  it('carries a rounded twelfth inch into the next foot', () => {
    expect(centimetersToFeetInches(182)).toEqual({feet: 6, inches: 0})
    expect(centimetersToFeetInches(182)).not.toEqual({feet: 5, inches: 12})
  })

  it('returns the original feet and inches after a round trip through centimetres', () => {
    expect(centimetersToFeetInches(feetInchesToCentimeters(6, 0))).toEqual({feet: 6, inches: 0})
    expect(centimetersToFeetInches(feetInchesToCentimeters(6, 0))).not.toEqual({feet: 5, inches: 12})
    expect(centimetersToFeetInches(feetInchesToCentimeters(5, 11))).toEqual({feet: 5, inches: 11})
  })

  it('splits a zero height into zero feet and zero inches', () => {
    expect(centimetersToFeetInches(0)).toEqual({feet: 0, inches: 0})
  })

  // Flooring would answer {feet: -6, inches: -10}, a pair that adds up to -82in rather than the -70in
  // it was given, so the split would no longer describe the height it came from
  it('keeps feet and inches adding back up to the rounded total for a negative reading', () => {
    const {feet, inches} = centimetersToFeetInches(-177.8)

    expect(feet * INCHES_PER_FOOT + inches).toBe(-70)
  })

  it('propagates a non-numeric height instead of reporting a real one', () => {
    const {feet, inches} = centimetersToFeetInches(NaN)

    expect(feet).toBeNaN()
    expect(inches).toBeNaN()
  })
})

describe('formatHeightImperial', () => {
  it('joins feet and inches with a foot mark and an inch mark', () => {
    expect(formatHeightImperial(5, 10)).toBe(`5'10"`)
  })

  it('keeps a zero inch value in the output', () => {
    expect(formatHeightImperial(6, 0)).toBe(`6'0"`)
  })
})

describe('isSupportedBodyWeightKg', () => {
  it('accepts both ends of the supported range inclusively', () => {
    expect(isSupportedBodyWeightKg(30)).toBe(true)
    expect(isSupportedBodyWeightKg(300)).toBe(true)
  })

  it('accepts a typical adult weight', () => {
    expect(isSupportedBodyWeightKg(82.6)).toBe(true)
  })

  it('rejects values just outside either end', () => {
    expect(isSupportedBodyWeightKg(29.9)).toBe(false)
    expect(isSupportedBodyWeightKg(300.1)).toBe(false)
  })

  it('rejects non-positive and non-finite readings', () => {
    expect(isSupportedBodyWeightKg(0)).toBe(false)
    expect(isSupportedBodyWeightKg(-1)).toBe(false)
    expect(isSupportedBodyWeightKg(NaN)).toBe(false)
    expect(isSupportedBodyWeightKg(Infinity)).toBe(false)
    expect(isSupportedBodyWeightKg(-Infinity)).toBe(false)
  })
})

describe('isSupportedBodyWeightInUnit', () => {
  it('accepts a pound reading that lands inside the kilogram envelope', () => {
    expect(isSupportedBodyWeightInUnit(182.2, 'lb')).toBe(true)
  })

  it('rejects 60 lb, so the About-you weight field starts empty instead of prefilling 27.2 kg', () => {
    expect(isSupportedBodyWeightInUnit(60, 'lb')).toBe(false)
  })

  it('accepts the same 60 read in kilograms, because the unit is part of the decision', () => {
    expect(isSupportedBodyWeightInUnit(60, 'kg')).toBe(true)
  })

  it('rejects a pound reading above the kilogram ceiling', () => {
    expect(isSupportedBodyWeightInUnit(700, 'lb')).toBe(false)
  })

  // 30kg is 66.1387lb and 300kg is 661.3868lb; taking the probes a full pound either side of each
  // bound keeps floating-point noise from deciding the outcome
  it('gates pounds on the converted kilogram bounds, not on rounded pound thresholds', () => {
    expect(isSupportedBodyWeightInUnit(67.1387, 'lb')).toBe(true)
    expect(isSupportedBodyWeightInUnit(65.1387, 'lb')).toBe(false)
    expect(isSupportedBodyWeightInUnit(660.387, 'lb')).toBe(true)
    expect(isSupportedBodyWeightInUnit(662.387, 'lb')).toBe(false)
  })

  // 66-661lb is only the rounded rendering of the 30-300kg envelope, and the two disagree inside the
  // rounding: 66.05lb is 29.96kg (under the floor) while 661.2lb is 299.92kg (still under the ceiling)
  it('parts company with a 66-661 lb gate wherever the rounding and the kilogram bounds differ', () => {
    expect(isSupportedBodyWeightInUnit(66.05, 'lb')).toBe(false)
    expect(isSupportedBodyWeightInUnit(661.2, 'lb')).toBe(true)
  })

  it('rejects non-finite and negative readings in either unit', () => {
    expect(isSupportedBodyWeightInUnit(NaN, 'lb')).toBe(false)
    expect(isSupportedBodyWeightInUnit(Infinity, 'kg')).toBe(false)
    expect(isSupportedBodyWeightInUnit(-5, 'lb')).toBe(false)
  })
})

describe('weightUnitPrefFor', () => {
  it('keeps a pounds user on the lb side of the weight toggle', () => {
    expect(weightUnitPrefFor('lbs')).toBe('lb')
  })

  it('keeps a kilograms user on the kg side of the weight toggle', () => {
    expect(weightUnitPrefFor('kg')).toBe('kg')
  })

  it('defaults a stone user to kg, because the Figma unit control offers lb and kg only', () => {
    expect(weightUnitPrefFor('st')).toBe('kg')
  })
})

describe('heightUnitPrefFor', () => {
  it('pairs a pounds user with ft-in height entry', () => {
    expect(heightUnitPrefFor('lbs')).toBe('ft_in')
  })

  it('pairs a kilograms user with cm height entry', () => {
    expect(heightUnitPrefFor('kg')).toBe('cm')
  })

  it('defaults a stone user to cm, the metric default that also denies them a weigh-in prefill', () => {
    expect(heightUnitPrefFor('st')).toBe('cm')
  })
})

describe('display preference defaults across every weight unit', () => {
  it('maps every supported weight unit to a member of its own preference union', () => {
    const weightPrefs: WeightUnitPref[] = ['lb', 'kg']
    const heightPrefs: HeightUnitPref[] = ['ft_in', 'cm']

    WEIGHT_UNITS.forEach(unit => {
      expect(weightPrefs).toContain(weightUnitPrefFor(unit))
      expect(heightPrefs).toContain(heightUnitPrefFor(unit))
    })
  })
})
