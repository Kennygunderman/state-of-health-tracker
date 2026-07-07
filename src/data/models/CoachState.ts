import {WeightUnit} from './WeightUnit'

export type CoachConfidence = 'calibrating' | 'low' | 'medium' | 'high'

export type CoachMode = 'manual' | 'coached' | 'paused'

export type CoachGoal = 'lose' | 'maintain' | 'gain'

export type CoachSex = 'male' | 'female' | 'unspecified'

export type FatBias = 'low' | 'balanced' | 'high'

export interface ExpenditurePoint {
  day: string
  tdeeKcal: number
  trendWeightKg: number | null
}

export interface CoachPlan {
  id: string
  weekStart: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  tdeeKcal: number
  previousTdeeKcal: number | null
  held: boolean
  guardrails: string[]
  acknowledgedAt: string | null
}

export interface CoachState {
  mode: CoachMode
  goal: CoachGoal | null
  ratePctBw: number | null
  proteinPref: number | null
  fatBias: FatBias | null
  tdeeKcal: number | null
  trendWeightKg: number | null
  confidence: CoachConfidence
  weightUnit: WeightUnit
  expenditureSeries: ExpenditurePoint[]
  activePlan: CoachPlan | null
  pendingCheckIn: CoachPlan | null
}

export interface EnrollCoachPayload {
  goal: CoachGoal
  ratePctBw: number
  sex?: CoachSex | null
  birthDate?: string | null
  heightCm?: number | null
}

export interface UpdateCoachSettingsPayload {
  goal?: CoachGoal
  ratePctBw?: number
  proteinPref?: number | null
  fatBias?: FatBias | null
  mode?: 'coached' | 'paused'
}

export interface UserProfile {
  sex: string | null
  birthDate: string | null
  heightCm: number | null
  weightUnit: string | null
  timezone: string | null
}

export interface UpdateProfilePayload {
  sex?: 'male' | 'female' | 'unspecified' | null
  birthDate?: string | null
  heightCm?: number | null
  weightUnit?: WeightUnit
  timezone?: string
}
