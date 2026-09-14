import {MacroTotals} from '@data/models/Macros'
import {CurrentMealPlans, MealPlan, MealPlanDay} from '@data/models/MealPlan'

import {selectSeededMealPlanDay} from '../useMealPlanDayQuery.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const DATE = '2026-07-06'
const OTHER_DATE = '2026-07-09'

const makeTotals = (): MacroTotals => ({calories: 2100, protein: 160, carbs: 205, fat: 70})

const makeDay = (overrides: Partial<MealPlanDay> = {}): MealPlanDay => ({
  id: 'day-1',
  date: DATE,
  dayIndex: 0,
  plannedTotals: makeTotals(),
  isLastDay: false,
  meals: [],
  ...overrides
})

const makePlan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
  id: PLAN_ID,
  revision: 4,
  generationAttempt: 1,
  startDate: DATE,
  endDate: '2026-07-12',
  status: 'active',
  targets: makeTotals(),
  generationTargets: makeTotals(),
  targetsStale: false,
  preferencesRevision: 2,
  targetsRevision: 3,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 34, loggedEntryCount: 2},
  days: [makeDay()],
  ...overrides
})

const makePlans = (overrides: Partial<CurrentMealPlans> = {}): CurrentMealPlans => ({
  current: makePlan(),
  upcoming: null,
  ...overrides
})

describe('selectSeededMealPlanDay', () => {
  describe('when the cached current-plan entry cannot answer the request', () => {
    it('returns undefined when nothing is cached under mealPlanCurrent', () => {
      expect(selectSeededMealPlanDay(undefined, PLAN_ID, DATE)).toBeUndefined()
    })

    it('returns undefined when neither cached plan is the requested one', () => {
      const plans = makePlans({current: makePlan({id: OTHER_PLAN_ID})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toBeUndefined()
    })

    it('returns undefined when the requested date falls outside the matched plan\u2019s days', () => {
      const plans = makePlans()

      expect(selectSeededMealPlanDay(plans, PLAN_ID, OTHER_DATE)).toBeUndefined()
    })

    it('returns undefined for the no-plan answer, where both members are null', () => {
      const plans = makePlans({current: null, upcoming: null})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toBeUndefined()
    })
  })

  describe('when a cached plan holds the requested day', () => {
    it('seeds the envelope from the current plan with that plan\u2019s own id, revision and status', () => {
      const day = makeDay({id: 'day-3', date: DATE, dayIndex: 2})
      const plans = makePlans({
        current: makePlan({revision: 7, status: 'superseded', days: [makeDay({id: 'day-1', date: OTHER_DATE}), day]})
      })

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 7,
        planStatus: 'superseded',
        day
      })
    })

    it('carries the cached day object through untouched', () => {
      const day = makeDay()
      const plans = makePlans({current: makePlan({days: [day]})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)?.day).toBe(day)
    })

    it('seeds from the upcoming plan when no current plan exists', () => {
      const day = makeDay({id: 'upcoming-day-1'})
      const plans = makePlans({current: null, upcoming: makePlan({revision: 1, days: [day]})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 1,
        planStatus: 'active',
        day
      })
    })

    it('seeds from the upcoming plan when the current plan is a different one', () => {
      const day = makeDay({id: 'upcoming-day-1'})
      const plans = makePlans({
        current: makePlan({id: OTHER_PLAN_ID, revision: 9}),
        upcoming: makePlan({revision: 2, days: [day]})
      })

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 2,
        planStatus: 'active',
        day
      })
    })
  })
})
