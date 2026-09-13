import type {
  ManualNutritionTargetValues,
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload,
  SaveManualNutritionTargetsPayload
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'

export interface SaveEstimatedNutritionTargetsInputs {
  // The revision of the preferences the displayed estimate was computed from.
  estimateRevision: number
  // The targets revision as the saving screen last read it.
  targetsRevision: number
}

export interface SaveManualNutritionTargetsInputs {
  values: ManualNutritionTargetValues
  targetsRevision: number
}

// The pin as a spreadable fragment: absent at NO_TARGETS_REVISION, present as the read revision above it. It is
// omitted rather than sent as 0 because the two are different statements to the server — omitting it says "there
// is no prior revision to replace", which is accepted only while no target has been confirmed — and only the
// omission survives a parser that rejects a pin no stored record can match.
const targetsRevisionPin = (targetsRevision: number): {expectedTargetsRevision?: number} =>
  targetsRevision === NO_TARGETS_REVISION ? {} : {expectedTargetsRevision: targetsRevision}

/**
 * Whether generation will accept these targets as they stand: it requires all four values and a source other
 * than 'legacy' (otherwise 422 targets_missing / 409 targets_unconfirmed).
 *
 * Staleness is deliberately no part of this — a confirmed estimate stays the value generation uses until the
 * user reconfirms it. A source this build cannot read decodes to null, so that one unknown value cannot reject
 * an otherwise valid response; an unreadable source is not a confirmed one, and is refused here rather than
 * assumed to be acceptable.
 */
export const isPlannerConfirmedTargets = (targets: NutritionTargets | null): targets is NutritionTargets =>
  targets !== null && targets.complete && (targets.source === 'estimated' || targets.source === 'manual')

/**
 * Whether the server holds any target figure at all. The four values are independently nullable, so a
 * calories-only account and a set with one saved macro both answer true: they are the user's own figures, and
 * the surfaces that review them lead with them rather than with a calculated estimate.
 */
export const hasAnyTargetValue = (targets: NutritionTargets | null): boolean => {
  if (targets === null || targets.targets === null) {
    return false
  }

  const {calories, protein, carbs, fat} = targets.targets

  return calories !== null || protein !== null || carbs !== null || fat !== null
}

/**
 * The four confirmed values when the server holds a complete, planner-confirmed set, and null otherwise.
 *
 * This is what an editor compares its fields against to tell "the user left the saved targets alone" from "the
 * user entered these numbers", so that neither answer rests on what the current estimate happens to be.
 */
export const confirmedTargetValues = (targets: NutritionTargets | null): ManualNutritionTargetValues | null => {
  if (!isPlannerConfirmedTargets(targets) || targets.targets === null) {
    return null
  }

  const {calories, protein, carbs, fat} = targets.targets

  if (calories === null || protein === null || carbs === null || fat === null) {
    return null
  }

  return {calories, protein, carbs, fat}
}

/**
 * The body that confirms the calculated estimate. It carries no figures: the server recomputes them from the
 * stored preferences that `estimateRevision` pins, which is what stops a client declaring its own numbers
 * estimated — and what makes this body truthful only when the estimate is the set the user was shown.
 */
export const buildSaveEstimatedNutritionTargetsPayload = ({
  estimateRevision,
  targetsRevision
}: SaveEstimatedNutritionTargetsInputs): SaveEstimatedNutritionTargetsPayload => ({
  source: 'estimated',
  estimateRevision,
  ...targetsRevisionPin(targetsRevision)
})

/**
 * The body that states four figures of the user's own. They are stored exactly as given and never rebalanced
 * against the calorie figure, so this is the only truthful body for any set the server did not calculate.
 */
export const buildSaveManualNutritionTargetsPayload = ({
  values,
  targetsRevision
}: SaveManualNutritionTargetsInputs): SaveManualNutritionTargetsPayload => ({
  source: 'manual',
  ...values,
  ...targetsRevisionPin(targetsRevision)
})
