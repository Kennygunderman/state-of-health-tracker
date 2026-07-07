import {CoachGoal} from '@data/models/CoachState'
import {WeightUnit} from '@data/models/WeightUnit'

import {
  COACH_RATE_AGGRESSIVE,
  COACH_RATE_FAST,
  COACH_RATE_GENTLE,
  COACH_RATE_LEAN,
  COACH_RATE_RAPID,
  COACH_RATE_STANDARD
} from '@constants/strings'

export interface RatePreset {
  pct: number
  label: string
}

// Bounds mirror the server's validation (coach.controller RATE_BOUNDS)
export const RATE_PRESETS: Record<CoachGoal, RatePreset[]> = {
  lose: [
    {pct: 0.25, label: COACH_RATE_GENTLE},
    {pct: 0.5, label: COACH_RATE_STANDARD},
    {pct: 0.75, label: COACH_RATE_AGGRESSIVE},
    {pct: 1.0, label: COACH_RATE_RAPID}
  ],
  gain: [
    {pct: 0.1, label: COACH_RATE_LEAN},
    {pct: 0.25, label: COACH_RATE_STANDARD},
    {pct: 0.5, label: COACH_RATE_FAST}
  ],
  maintain: []
}

export const DEFAULT_RATE: Record<CoachGoal, number> = {
  lose: 0.5,
  gain: 0.25,
  maintain: 0
}

const LBS_PER_KG = 2.2046226218

/** "≈ 0.9" — projected weekly change in the user's display unit (stone users read lbs). */
export const formatWeeklyChange = (pct: number, trendWeightKg: number | null, unit: WeightUnit): string | null => {
  if (trendWeightKg === null) return null

  const kgPerWeek = (pct / 100) * trendWeightKg
  const value = unit === 'kg' ? kgPerWeek : kgPerWeek * LBS_PER_KG

  return (Math.round(value * 10) / 10).toString()
}

export const weeklyChangeUnitLabel = (unit: WeightUnit): string => (unit === 'kg' ? 'kg' : 'lbs')
