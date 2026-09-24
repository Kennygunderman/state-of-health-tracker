import {
  NutritionTargetFeasibilityWarning,
  NutritionTargets,
  NutritionTargetSource,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'
import {TargetsResponse, TargetsSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_TARGET_SOURCES: NutritionTargetSource[] = ['estimated', 'manual', 'legacy']
const KNOWN_FEASIBILITY_WARNINGS: NutritionTargetFeasibilityWarning[] = [
  'macro_energy_mismatch',
  'below_catalog_min',
  'above_catalog_max'
]

export type NutritionTargetsSaveResult = SaveNutritionTargetsResult

// The server owns these values: `targets` is null only when it sends null and its four members stay independently
// nullable (a calories-only account keeps three null macros), while `complete` and `stale` are carried rather than
// derived. `source` is resolved here — an unrecognized value becomes null, so a future source never rejects a
// response the rest of which is valid.
export function convertNutritionTargets(data: io.TypeOf<typeof TargetsResponse>): NutritionTargets {
  return {
    targets: data.targets,
    complete: data.complete,
    source: KNOWN_TARGET_SOURCES.includes(data.source as NutritionTargetSource)
      ? (data.source as NutritionTargetSource)
      : null,
    stale: data.stale,
    revision: data.revision
  }
}

export function convertNutritionTargetsSaveResult(
  data: io.TypeOf<typeof TargetsSaveResponse>
): NutritionTargetsSaveResult {
  return {
    targets: convertNutritionTargets(data.targets),
    feasibility: {
      ok: data.feasibility.ok,
      // Unrecognized codes are dropped rather than substituted: strings.ts has no copy for one. Warnings never
      // signal failure — infeasible-but-valid targets are saved and returned with them.
      warnings: data.feasibility.warnings.filter((warning): warning is NutritionTargetFeasibilityWarning =>
        KNOWN_FEASIBILITY_WARNINGS.includes(warning as NutritionTargetFeasibilityWarning)
      )
    }
  }
}
