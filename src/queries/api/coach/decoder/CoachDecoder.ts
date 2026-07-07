import * as io from 'io-ts'

const nullableNumber = io.union([io.number, io.null])
const nullableString = io.union([io.string, io.null])

const ExpenditurePointResponse = io.type({
  day: io.string,
  tdeeKcal: io.number,
  trendWeightKg: nullableNumber
})

const CoachPlanResponse = io.type({
  id: io.string,
  weekStart: io.string,
  calories: io.number,
  proteinG: io.number,
  carbsG: io.number,
  fatG: io.number,
  tdeeKcal: io.number,
  previousTdeeKcal: nullableNumber,
  held: io.boolean,
  guardrails: io.array(io.string),
  acknowledgedAt: nullableString
})

export const CoachStateResponse = io.type({
  mode: io.union([io.literal('manual'), io.literal('coached'), io.literal('paused')]),
  goal: io.union([io.literal('lose'), io.literal('maintain'), io.literal('gain'), io.null]),
  ratePctBw: nullableNumber,
  proteinPref: nullableNumber,
  fatBias: io.union([io.literal('low'), io.literal('balanced'), io.literal('high'), io.null]),
  tdeeKcal: nullableNumber,
  trendWeightKg: nullableNumber,
  confidence: io.union([io.literal('calibrating'), io.literal('low'), io.literal('medium'), io.literal('high')]),
  weightUnit: io.union([io.literal('lbs'), io.literal('kg'), io.literal('st')]),
  expenditureSeries: io.array(ExpenditurePointResponse),
  activePlan: io.union([CoachPlanResponse, io.null]),
  pendingCheckIn: io.union([CoachPlanResponse, io.null])
})

export const UserProfileResponse = io.type({
  sex: nullableString,
  birthDate: nullableString,
  heightCm: nullableNumber,
  weightUnit: nullableString,
  timezone: nullableString
})

export const CoachActionResponse = io.type({
  success: io.boolean
})
