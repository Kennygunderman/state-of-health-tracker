import {
  MEAL_PLAN_PACE_DEFICIT_TEMPLATE,
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_PACE_RECOMMENDED_SUFFIX,
  MEAL_PLAN_PACE_SURPLUS_TEMPLATE
} from '@constants/strings'

import {
  goalWeightToKilograms,
  isGoalWeightOnGoalSide,
  isGoalWeightVisible,
  isPaceVisible,
  MealPlanGoalContext,
  MealPlanGoalFields,
  paceOptionsForGoal,
  parseGoalWeightInput,
  validateMealPlanGoal
} from '../index.util'

const makeFields = (overrides: Partial<MealPlanGoalFields> = {}): MealPlanGoalFields => ({
  goal: null,
  goalWeightText: '',
  paceLbPerWeek: null,
  ...overrides
})

const makeContext = (overrides: Partial<MealPlanGoalContext> = {}): MealPlanGoalContext => ({
  currentWeightKg: null,
  unit: 'lb',
  ...overrides
})

describe('isPaceVisible', () => {
  it('shows the pace section for a loss or a gain goal', () => {
    expect(isPaceVisible('lose')).toBe(true)
    expect(isPaceVisible('gain')).toBe(true)
  })

  it('hides the pace section for maintain and before a goal is chosen', () => {
    expect(isPaceVisible('maintain')).toBe(false)
    expect(isPaceVisible(null)).toBe(false)
  })
})

describe('isGoalWeightVisible', () => {
  it('shows the goal-weight field for a loss or a gain goal', () => {
    expect(isGoalWeightVisible('lose')).toBe(true)
    expect(isGoalWeightVisible('gain')).toBe(true)
  })

  it('hides the goal-weight field for maintain and before a goal is chosen', () => {
    expect(isGoalWeightVisible('maintain')).toBe(false)
    expect(isGoalWeightVisible(null)).toBe(false)
  })
})

describe('parseGoalWeightInput', () => {
  it('parses whole and decimal readings, rounding to one decimal', () => {
    expect(parseGoalWeightInput('170')).toBe(170)
    expect(parseGoalWeightInput('170.4')).toBe(170.4)
    expect(parseGoalWeightInput('170.46')).toBe(170.5)
    expect(parseGoalWeightInput('.5')).toBe(0.5)
  })

  it('accepts a comma as the decimal separator', () => {
    expect(parseGoalWeightInput('170,5')).toBe(170.5)
  })

  it('ignores surrounding whitespace', () => {
    expect(parseGoalWeightInput(' 170 ')).toBe(170)
  })

  it('rejects empty, non-numeric, signed and zero input', () => {
    expect(parseGoalWeightInput('')).toBeNull()
    expect(parseGoalWeightInput('.')).toBeNull()
    expect(parseGoalWeightInput('abc')).toBeNull()
    expect(parseGoalWeightInput('12a')).toBeNull()
    expect(parseGoalWeightInput('-170')).toBeNull()
    expect(parseGoalWeightInput('0')).toBeNull()
  })
})

describe('goalWeightToKilograms', () => {
  it('converts a pound reading to kilograms', () => {
    expect(goalWeightToKilograms(170, 'lb')).toBeCloseTo(77.1107029, 7)
  })

  it('passes a kilogram reading through unchanged', () => {
    expect(goalWeightToKilograms(82.5, 'kg')).toBe(82.5)
  })
})

describe('isGoalWeightOnGoalSide', () => {
  it('requires a loss goal weight below the current weight', () => {
    expect(isGoalWeightOnGoalSide(77, 82.5, 'lose')).toBe(true)
    expect(isGoalWeightOnGoalSide(90, 82.5, 'lose')).toBe(false)
  })

  it('requires a gain goal weight above the current weight', () => {
    expect(isGoalWeightOnGoalSide(90, 82.5, 'gain')).toBe(true)
    expect(isGoalWeightOnGoalSide(77, 82.5, 'gain')).toBe(false)
  })

  it('treats a goal weight equal to the current weight as neither a loss nor a gain', () => {
    expect(isGoalWeightOnGoalSide(82.5, 82.5, 'lose')).toBe(false)
    expect(isGoalWeightOnGoalSide(82.5, 82.5, 'gain')).toBe(false)
  })

  it('accepts either direction while the current weight is unknown', () => {
    expect(isGoalWeightOnGoalSide(90, null, 'lose')).toBe(true)
    expect(isGoalWeightOnGoalSide(77, null, 'gain')).toBe(true)
  })

  it('accepts any goal weight when no direction applies', () => {
    expect(isGoalWeightOnGoalSide(90, 82.5, 'maintain')).toBe(true)
    expect(isGoalWeightOnGoalSide(90, 82.5, null)).toBe(true)
  })
})

describe('paceOptionsForGoal', () => {
  it('offers the three loss paces with their daily deficit', () => {
    expect(paceOptionsForGoal('lose')).toEqual([
      {
        value: 0.5,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '0.5'),
        subcopy: MEAL_PLAN_PACE_DEFICIT_TEMPLATE.replace('{calories}', '250')
      },
      {
        value: 1,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '1'),
        subcopy: `${MEAL_PLAN_PACE_DEFICIT_TEMPLATE.replace('{calories}', '500')}${MEAL_PLAN_PACE_RECOMMENDED_SUFFIX}`
      },
      {
        value: 1.5,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '1.5'),
        subcopy: MEAL_PLAN_PACE_DEFICIT_TEMPLATE.replace('{calories}', '750')
      }
    ])
  })

  it('offers the three gain paces with their daily surplus', () => {
    expect(paceOptionsForGoal('gain')).toEqual([
      {
        value: 0.5,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '0.5'),
        subcopy: MEAL_PLAN_PACE_SURPLUS_TEMPLATE.replace('{calories}', '250')
      },
      {
        value: 1,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '1'),
        subcopy: `${MEAL_PLAN_PACE_SURPLUS_TEMPLATE.replace('{calories}', '500')}${MEAL_PLAN_PACE_RECOMMENDED_SUFFIX}`
      },
      {
        value: 1.5,
        label: MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '1.5'),
        subcopy: MEAL_PLAN_PACE_SURPLUS_TEMPLATE.replace('{calories}', '750')
      }
    ])
  })

  it('marks only the one-pound pace as recommended', () => {
    const recommended = paceOptionsForGoal('lose').filter(option =>
      option.subcopy.endsWith(MEAL_PLAN_PACE_RECOMMENDED_SUFFIX)
    )

    expect(recommended.map(option => option.value)).toEqual([1])
  })

  it('substitutes each pace and its daily calorie figure, so no two options read alike', () => {
    const labels = paceOptionsForGoal('lose').map(option => option.label)
    const subcopy = paceOptionsForGoal('lose').map(option => option.subcopy)

    expect(labels[0]).not.toBe(labels[1])
    expect(labels[1]).not.toBe(labels[2])
    expect(labels[0]).toContain('0.5')
    expect(labels[2]).toContain('1.5')
    expect(subcopy[0]).toContain('250')
    expect(subcopy[1]).toContain('500')
    expect(subcopy[2]).toContain('750')
  })

  it('keeps a gain surplus from reading like a loss deficit at every pace', () => {
    const losing = paceOptionsForGoal('lose')
    const gaining = paceOptionsForGoal('gain')

    expect(MEAL_PLAN_PACE_DEFICIT_TEMPLATE).not.toBe(MEAL_PLAN_PACE_SURPLUS_TEMPLATE)
    gaining.forEach((option, index) => expect(option.subcopy).not.toBe(losing[index].subcopy))
  })

  it('offers no paces for maintain or before a goal is chosen', () => {
    expect(paceOptionsForGoal('maintain')).toEqual([])
    expect(paceOptionsForGoal(null)).toEqual([])
  })
})

describe('validateMealPlanGoal', () => {
  it('asks only for the goal on first entry', () => {
    const validation = validateMealPlanGoal(makeFields(), makeContext())

    expect(validation).toEqual({
      errors: {goal: 'goal_required', goalWeight: null, pace: null},
      isValid: false,
      goalWeightKg: null
    })
  })

  it('leaves the hidden goal-weight control silent while no goal is chosen', () => {
    const validation = validateMealPlanGoal(makeFields({goalWeightText: 'abc'}), makeContext())

    expect(validation).toEqual({
      errors: {goal: 'goal_required', goalWeight: null, pace: null},
      isValid: false,
      goalWeightKg: null
    })
  })

  it('requires a pace once a loss goal is chosen', () => {
    const validation = validateMealPlanGoal(makeFields({goal: 'lose'}), makeContext())

    expect(validation.errors).toEqual({goal: null, goalWeight: null, pace: 'pace_required'})
    expect(validation.isValid).toBe(false)
  })

  it('accepts maintain with no pace and no goal weight', () => {
    const validation = validateMealPlanGoal(makeFields({goal: 'maintain'}), makeContext())

    expect(validation.errors).toEqual({goal: null, goalWeight: null, pace: null})
    expect(validation.isValid).toBe(true)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('discards a goal weight typed before switching to maintain', () => {
    const fields = makeFields({goal: 'maintain', goalWeightText: 'abc'})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors.goalWeight).toBeNull()
    expect(validation.isValid).toBe(true)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('treats an empty goal weight as the optional answer it is', () => {
    const validation = validateMealPlanGoal(makeFields({goal: 'lose', paceLbPerWeek: 1}), makeContext())

    expect(validation.errors).toEqual({goal: null, goalWeight: null, pace: null})
    expect(validation.isValid).toBe(true)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('treats a whitespace-only goal weight as empty', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '   ', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors.goalWeight).toBeNull()
    expect(validation.isValid).toBe(true)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('rejects a goal weight that cannot be parsed', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '17o', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors.goalWeight).toBe('goal_weight_invalid')
    expect(validation.isValid).toBe(false)
    expect(validation.goalWeightKg).toBeNull()
  })

  // The supported window is kilogram-canonical (30-300 kg), so in pounds it opens at 66.14 lb: a 66 lb
  // entry reads as 29.94 kg and has to fail here rather than at the API that enforces the same bound.
  it('rejects a pound goal weight a fraction below the kilogram floor', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '66', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors.goalWeight).toBe('goal_weight_out_of_range')
    expect(validation.isValid).toBe(false)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('accepts the first pound reading inside the kilogram floor', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '66.2', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors.goalWeight).toBeNull()
    expect(validation.isValid).toBe(true)
    expect(validation.goalWeightKg).toBeCloseTo(30.0278149, 7)
  })

  it('closes the pound window at the kilogram ceiling', () => {
    const atCeiling = makeFields({goal: 'gain', goalWeightText: '661.3', paceLbPerWeek: 1})
    const pastCeiling = makeFields({goal: 'gain', goalWeightText: '661.4', paceLbPerWeek: 1})
    const wellPastCeiling = makeFields({goal: 'gain', goalWeightText: '661.5', paceLbPerWeek: 1})

    expect(validateMealPlanGoal(atCeiling, makeContext()).errors.goalWeight).toBeNull()
    expect(validateMealPlanGoal(pastCeiling, makeContext()).errors.goalWeight).toBe('goal_weight_out_of_range')
    expect(validateMealPlanGoal(wellPastCeiling, makeContext()).errors.goalWeight).toBe('goal_weight_out_of_range')
  })

  it('applies the kilogram window inclusively when the unit is kilograms', () => {
    const context = makeContext({unit: 'kg'})
    const belowFloor = makeFields({goal: 'lose', goalWeightText: '29.9', paceLbPerWeek: 1})
    const atFloor = makeFields({goal: 'lose', goalWeightText: '30', paceLbPerWeek: 1})
    const atCeiling = makeFields({goal: 'lose', goalWeightText: '300', paceLbPerWeek: 1})
    const aboveCeiling = makeFields({goal: 'lose', goalWeightText: '300.1', paceLbPerWeek: 1})

    expect(validateMealPlanGoal(belowFloor, context).errors.goalWeight).toBe('goal_weight_out_of_range')
    expect(validateMealPlanGoal(atFloor, context).errors.goalWeight).toBeNull()
    expect(validateMealPlanGoal(atCeiling, context).errors.goalWeight).toBeNull()
    expect(validateMealPlanGoal(aboveCeiling, context).errors.goalWeight).toBe('goal_weight_out_of_range')
  })

  it('rejects a loss goal weight above the current weight', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '90', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext({currentWeightKg: 82.5, unit: 'kg'}))

    expect(validation.errors.goalWeight).toBe('goal_weight_wrong_side')
    expect(validation.isValid).toBe(false)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('rejects a gain goal weight below the current weight', () => {
    const fields = makeFields({goal: 'gain', goalWeightText: '75', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext({currentWeightKg: 82.5, unit: 'kg'}))

    expect(validation.errors.goalWeight).toBe('goal_weight_wrong_side')
    expect(validation.isValid).toBe(false)
    expect(validation.goalWeightKg).toBeNull()
  })

  it('rejects a goal weight identical to the current weight for either direction', () => {
    const context = makeContext({currentWeightKg: 82.5, unit: 'kg'})
    const losing = makeFields({goal: 'lose', goalWeightText: '82.5', paceLbPerWeek: 1})
    const gaining = makeFields({goal: 'gain', goalWeightText: '82.5', paceLbPerWeek: 1})

    expect(validateMealPlanGoal(losing, context).errors.goalWeight).toBe('goal_weight_wrong_side')
    expect(validateMealPlanGoal(gaining, context).errors.goalWeight).toBe('goal_weight_wrong_side')
  })

  it('accepts a goal weight on either side while the current weight is unknown', () => {
    const context = makeContext({unit: 'kg'})
    const losing = validateMealPlanGoal(makeFields({goal: 'lose', goalWeightText: '95'}), context)
    const gaining = validateMealPlanGoal(makeFields({goal: 'gain', goalWeightText: '60'}), context)

    expect(losing.errors.goalWeight).toBeNull()
    expect(losing.goalWeightKg).toBe(95)
    expect(gaining.errors.goalWeight).toBeNull()
    expect(gaining.goalWeightKg).toBe(60)
  })

  it('reports a missing pace and an unparseable goal weight in the same result', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: 'abc'})
    const validation = validateMealPlanGoal(fields, makeContext())

    expect(validation.errors).toEqual({goal: null, goalWeight: 'goal_weight_invalid', pace: 'pace_required'})
    expect(validation.isValid).toBe(false)
  })

  it('reports a missing pace and an out-of-range goal weight in the same result', () => {
    const fields = makeFields({goal: 'gain', goalWeightText: '20'})
    const validation = validateMealPlanGoal(fields, makeContext({unit: 'kg'}))

    expect(validation.errors).toEqual({goal: null, goalWeight: 'goal_weight_out_of_range', pace: 'pace_required'})
    expect(validation.isValid).toBe(false)
  })

  it('reports a missing pace and a wrong-side goal weight in the same result', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '90'})
    const validation = validateMealPlanGoal(fields, makeContext({currentWeightKg: 82.5, unit: 'kg'}))

    expect(validation.errors).toEqual({goal: null, goalWeight: 'goal_weight_wrong_side', pace: 'pace_required'})
    expect(validation.isValid).toBe(false)
  })

  it('passes a complete loss goal and converts the pound goal weight', () => {
    const fields = makeFields({goal: 'lose', goalWeightText: '170', paceLbPerWeek: 1})
    const validation = validateMealPlanGoal(fields, makeContext({currentWeightKg: 82.5}))

    expect(validation).toEqual({
      errors: {goal: null, goalWeight: null, pace: null},
      isValid: true,
      goalWeightKg: 77.1107029
    })
  })

  it('passes a complete gain goal entered in kilograms with a comma separator', () => {
    const fields = makeFields({goal: 'gain', goalWeightText: '85,5', paceLbPerWeek: 0.5})
    const validation = validateMealPlanGoal(fields, makeContext({currentWeightKg: 80, unit: 'kg'}))

    expect(validation).toEqual({
      errors: {goal: null, goalWeight: null, pace: null},
      isValid: true,
      goalWeightKg: 85.5
    })
  })
})
