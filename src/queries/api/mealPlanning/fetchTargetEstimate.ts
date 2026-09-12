import {NutritionTargetClampReason, NutritionTargetEstimate} from '@data/models/NutritionTargets'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

const TargetEstimateInputsResponse = io.type({
  age: io.number,
  heightCm: io.number,
  weightKg: io.number,
  sexForEstimate: io.union([io.literal('female'), io.literal('male'), io.literal('prefer_not_to_say')]),
  activityLevel: io.union([
    io.literal('not_very_active'),
    io.literal('lightly_active'),
    io.literal('active'),
    io.literal('very_active')
  ]),
  goal: io.union([io.literal('lose'), io.literal('maintain'), io.literal('gain')]),
  paceLbPerWeek: io.union([io.literal(0.5), io.literal(1), io.literal(1.5), io.null])
})

const TargetEstimateResponse = io.type({
  source: io.literal('estimated'),
  estimateRevision: io.number,
  inputs: TargetEstimateInputsResponse,
  bmr: io.number,
  tdee: io.number,
  adjustment: io.number,
  calories: io.number,
  protein: io.number,
  carbs: io.number,
  fat: io.number,
  clamped: io.boolean,
  clampReason: io.union([io.string, io.null])
})

// Decoded as a plain string and resolved here: an unrecognized bound becomes null, so a future server reason
// renders no caption instead of rejecting an otherwise valid estimate. The enumerated inputs above take the
// opposite treatment deliberately — none of them has an honest default, so the codec enforces them.
const KNOWN_CLAMP_REASONS: NutritionTargetClampReason[] = ['floor', 'below_bmr', 'ceiling']

export async function fetchTargetEstimate(): Promise<NutritionTargetEstimate> {
  try {
    const response = await httpGet(Endpoints.MealPlanTargetEstimate, TargetEstimateResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching target estimate: status=${response?.status}`)
    }

    const data = response.data

    return {
      source: data.source,
      estimateRevision: data.estimateRevision,
      inputs: {
        age: data.inputs.age,
        heightCm: data.inputs.heightCm,
        weightKg: data.inputs.weightKg,
        sexForEstimate: data.inputs.sexForEstimate,
        activityLevel: data.inputs.activityLevel,
        goal: data.inputs.goal,
        paceLbPerWeek: data.inputs.paceLbPerWeek
      },
      bmr: data.bmr,
      tdee: data.tdee,
      adjustment: data.adjustment,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      clamped: data.clamped,
      clampReason: KNOWN_CLAMP_REASONS.includes(data.clampReason as NutritionTargetClampReason)
        ? (data.clampReason as NutritionTargetClampReason)
        : null
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
