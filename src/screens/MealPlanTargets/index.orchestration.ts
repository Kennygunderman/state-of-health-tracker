import type {MacroTargets} from '@data/models/Macros'
import type {
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  SetupStepRequest
} from '@data/models/MealPlanPreferences'
import type {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload,
  SaveNutritionTargetsPayload,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'
import type {GenerationContext, RootStackParamList} from '@navigation/types'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {buildSaveEstimatedNutritionTargetsPayload, resolveStaleRevision} from '@utility/RevisionConflictUtility'

import {buildTargetConfirmationPayload, planGenerateSequence} from './index.util'

export type GeneratingRouteParams = RootStackParamList['Meal Plan Generating']

/**
 * What a press has already written and the revision the server answered with. A commitment lets the next
 * press resume the sequence rather than restart it (AAP 0.7.4), and it is only ever honoured while the live
 * revision still equals the one recorded here — see `runGenerateSequence`.
 */
export interface GenerateSequenceCommitments {
  confirmedTargetsRevision: number | null
  savedStartDate: {date: string; revision: number} | null
}

export const NO_GENERATE_COMMITMENTS: GenerateSequenceCommitments = Object.freeze({
  confirmedTargetsRevision: null,
  savedStartDate: null
})

/**
 * A refused write whose refetched values genuinely differ from the ones the press asserted, carrying
 * everything either answer needs: `payload` re-confirms the same estimate against the revision the refetch
 * reported, and `theirStartDate` is the value "Use theirs" adopts.
 */
export interface TargetsRevisionConflict {
  step: 'targets'
  payload: SaveEstimatedNutritionTargetsPayload
}

export interface StartDateRevisionConflict {
  step: 'startDate'
  startDate: string
  expectedRevision: number
  theirStartDate: string | null
}

export type GenerateRevisionConflict = TargetsRevisionConflict | StartDateRevisionConflict

/**
 * How far the sequence got. The screen turns this into copy: 'estimate_stale' and 'failed' report themselves
 * with a toast, 'conflict' raises the persistent prompt (0.7.2), and 'generating' has already navigated.
 * `commitments` is what the caller must hold for the next press, whichever branch was taken.
 */
export type GenerateSequenceOutcome =
  | {status: 'generating'; commitments: GenerateSequenceCommitments}
  | {status: 'estimate_stale'; commitments: GenerateSequenceCommitments}
  | {status: 'failed'; commitments: GenerateSequenceCommitments}
  | {status: 'conflict'; commitments: GenerateSequenceCommitments; conflict: GenerateRevisionConflict}

export interface GenerateSequenceCollaborators {
  saveTargets: (payload: SaveNutritionTargetsPayload) => Promise<SaveNutritionTargetsResult>
  saveSetupStep: (variables: SetupStepRequest) => Promise<MealPlanPreferencesSaveResult>
  refetchTargets: () => Promise<NutritionTargets | null>
  refetchPreferences: () => Promise<MealPlanPreferences | null>
  refetchEstimate: () => Promise<void>
  mintIdempotencyKey: () => string
  navigateToGenerating: (params: GeneratingRouteParams) => void
}

export interface GenerateSequenceRun {
  targets: NutritionTargets | null
  estimate: NutritionTargetEstimate | null
  preferences: MealPlanPreferences
  startDate: string
  // The nextWeek route param, which is what tells a successor week from a first-time setup; null in setup mode.
  planStartDate: string | null
  timeZone: string
  commitments: GenerateSequenceCommitments
  // The conflict the user answered with "Keep mine". It forces the refused write to be re-sent against the
  // revision the refetch reported, which a re-derived plan could not do: the refetched row now leads the card,
  // so deciding afresh would silently adopt the server's values instead.
  keepMineConflict: GenerateRevisionConflict | null
  collaborators: GenerateSequenceCollaborators
}

type TargetsStepResult =
  | {status: 'committed'; revision: number}
  | {status: 'estimate_stale'}
  | {status: 'failed'}
  | {status: 'conflict'; conflict: TargetsRevisionConflict}

type StartDateStepResult =
  | {status: 'committed'; revision: number}
  | {status: 'failed'}
  | {status: 'conflict'; conflict: StartDateRevisionConflict}

// A rejected targets revision is compared on the figures alone: everything else TargetsResponse carries is the
// server's own derivation from them, so comparing it would report bookkeeping as the user's change.
const TARGETS_CONFLICT_FIELDS: readonly (keyof NutritionTargets & string)[] = Object.freeze(['targets'])

// The one answer the review step writes to preferences, so a diet or a meal time edited elsewhere is never
// reported as a conflict with the plan's start date.
const REVIEW_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze(['reviewStartDate'])

// The literal type, not `SetupStep`: the wider annotation would not narrow against `SetupStepRequest` at the
// call site below, which is the pairing this step's save has to satisfy.
const REVIEW_STEP = 'review' as const

/**
 * Whether a recorded confirmation is still the revision the server holds. A commitment records "this press
 * wrote revision N", which only means "N is current" while nothing has written since — and Review stays
 * mounted while the target editor is pushed and popped, so an edit between two presses moves the live
 * revision past N. Reading the two as the same fact is what would carry a superseded revision into
 * generation, so anything other than equality makes the commitment obsolete.
 */
const isConfirmationCurrent = (commitments: GenerateSequenceCommitments, targets: NutritionTargets | null): boolean =>
  commitments.confirmedTargetsRevision !== null &&
  targets !== null &&
  targets.revision === commitments.confirmedTargetsRevision

/**
 * Whether a recorded start-date save is still the row the server holds: the same date, saved at the revision
 * preferences currently reports. The date alone is not enough — an answer edited on another step bumps the
 * revision without touching the start date, and the pin the next save sends has to be that newer one.
 */
const isStartDateSaveCurrent = (
  commitments: GenerateSequenceCommitments,
  startDate: string,
  preferences: MealPlanPreferences
): boolean =>
  commitments.savedStartDate !== null &&
  commitments.savedStartDate.date === startDate &&
  commitments.savedStartDate.revision === preferences.revision

/**
 * The figures a confirmation asserted. The payload sends a revision rather than numbers, so what it claimed is
 * the estimate's — the set the card was showing when the press happened.
 */
const assertedEstimateFigures = (estimate: NutritionTargetEstimate | null): MacroTargets | null =>
  estimate === null
    ? null
    : {calories: estimate.calories, protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat}

/**
 * Step one: confirm the displayed estimate.
 *
 * A rejected targets revision is never retried blindly (0.7.2). The authoritative figures are refetched and
 * compared with the ones this press asserted, so a confirmation whose response was lost, or the same
 * confirmation made from another device, is recognised as already written and the sequence continues instead
 * of writing twice. Figures that genuinely differ are the user's to settle, so they raise a conflict carrying
 * the payload a "Keep mine" answer re-sends against the revision just refetched.
 */
const confirmTargets = async (
  payload: SaveEstimatedNutritionTargetsPayload,
  estimate: NutritionTargetEstimate | null,
  collaborators: GenerateSequenceCollaborators
): Promise<TargetsStepResult> => {
  try {
    const saved = await collaborators.saveTargets(payload)

    return {status: 'committed', revision: saved.targets.revision}
  } catch (error) {
    const code = getApiErrorCode(error)

    // An estimate computed from inputs that have since moved is refused rather than saved: refetch the figures
    // and leave the user on Review to read them, which is the one recovery that cannot generate a plan against
    // numbers they were never shown.
    if (code === API_ERROR_CODES.estimateStale) {
      await collaborators.refetchEstimate()

      return {status: 'estimate_stale'}
    }

    if (code !== API_ERROR_CODES.staleTargets) {
      return {status: 'failed'}
    }

    const fresh = await collaborators.refetchTargets()

    if (fresh === null) {
      return {status: 'failed'}
    }

    const asserted = assertedEstimateFigures(estimate)
    const isAlreadyWritten =
      asserted !== null &&
      resolveStaleRevision<NutritionTargets>({targets: asserted}, fresh, TARGETS_CONFLICT_FIELDS).status === 'resolved'

    if (isAlreadyWritten) {
      return {status: 'committed', revision: fresh.revision}
    }

    // Absent figures to compare are treated as a difference rather than a match: with no estimate in hand the
    // press cannot be shown to have landed, and a prompt the user can answer is safer than assuming it did.
    return {
      status: 'conflict',
      conflict: {
        step: 'targets',
        payload: buildSaveEstimatedNutritionTargetsPayload({
          estimateRevision: payload.estimateRevision,
          targetsRevision: fresh.revision
        })
      }
    }
  }
}

/**
 * Step two: persist the reviewed start date, and only once step one has settled — a plan generated against an
 * unconfirmed target is the outcome the ordering exists to prevent.
 *
 * The same recovery applies: a refused revision whose refetched row already carries this date means the lost
 * write landed, so its revision is carried forward rather than the date being sent again.
 */
const saveStartDate = async (
  input: {startDate: string; timeZone: string; expectedRevision: number},
  collaborators: GenerateSequenceCollaborators
): Promise<StartDateStepResult> => {
  try {
    const saved = await collaborators.saveSetupStep({
      step: REVIEW_STEP,
      payload: {startDate: input.startDate, timeZone: input.timeZone, expectedRevision: input.expectedRevision}
    })

    return {status: 'committed', revision: saved.preferences.revision}
  } catch (error) {
    if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
      return {status: 'failed'}
    }

    const fresh = await collaborators.refetchPreferences()

    if (fresh === null) {
      return {status: 'failed'}
    }

    if (
      resolveStaleRevision<MealPlanPreferences>({reviewStartDate: input.startDate}, fresh, REVIEW_CONFLICT_FIELDS)
        .status === 'resolved'
    ) {
      return {status: 'committed', revision: fresh.revision}
    }

    return {
      status: 'conflict',
      conflict: {
        step: 'startDate',
        startDate: input.startDate,
        expectedRevision: fresh.revision,
        theirStartDate: fresh.reviewStartDate
      }
    }
  }
}

/**
 * The ordered sequence AAP 0.7.4 specifies: confirm the displayed estimate, persist a changed start date, then
 * navigate to generation with the revisions those steps returned. Nothing runs after a failure and nothing
 * navigates unless both steps have settled, so a plan is never generated against a value the server refused.
 *
 * The idempotency key is minted at the navigation itself, never earlier: a key survives only a byte-identical
 * replay, so a press that follows an edited answer or a re-saved target needs its own (0.7.2).
 */
export const runGenerateSequence = async (run: GenerateSequenceRun): Promise<GenerateSequenceOutcome> => {
  const {targets, estimate, preferences, startDate, keepMineConflict, collaborators} = run
  const plan = planGenerateSequence({targets, estimate, preferences, startDate})

  const isTargetsStepDone = isConfirmationCurrent(run.commitments, targets)
  const isStartDateStepDone = isStartDateSaveCurrent(run.commitments, startDate, preferences)

  let commitments: GenerateSequenceCommitments = {
    confirmedTargetsRevision: isTargetsStepDone ? run.commitments.confirmedTargetsRevision : null,
    savedStartDate: isStartDateStepDone ? run.commitments.savedStartDate : null
  }

  // The revisions the press carries are always the ones the queries currently report. A commitment decides
  // only whether its step may be skipped, and it can only be honoured while it equals the live value, so the
  // two can never disagree about what is being pinned.
  let targetsRevision = plan.expectedTargetsRevision
  let preferencesRevision = plan.expectedPreferencesRevision

  const keepMineTargets = keepMineConflict?.step === 'targets' ? keepMineConflict.payload : null
  const confirmation = keepMineTargets ?? (isTargetsStepDone ? null : buildTargetConfirmationPayload(plan))

  if (confirmation !== null) {
    const step = await confirmTargets(confirmation, estimate, collaborators)

    if (step.status === 'estimate_stale') {
      return {status: 'estimate_stale', commitments}
    }

    if (step.status === 'failed') {
      return {status: 'failed', commitments}
    }

    if (step.status === 'conflict') {
      return {status: 'conflict', commitments, conflict: step.conflict}
    }

    targetsRevision = step.revision
    commitments = {...commitments, confirmedTargetsRevision: step.revision}
  }

  const keepMineStartDate = keepMineConflict?.step === 'startDate' ? keepMineConflict : null
  const needsStartDateSave = keepMineStartDate !== null || (plan.requiresStartDateSave && !isStartDateStepDone)

  if (needsStartDateSave) {
    const step = await saveStartDate(
      {
        startDate,
        timeZone: run.timeZone,
        expectedRevision: keepMineStartDate?.expectedRevision ?? preferencesRevision
      },
      collaborators
    )

    if (step.status === 'failed') {
      return {status: 'failed', commitments}
    }

    if (step.status === 'conflict') {
      return {status: 'conflict', commitments, conflict: step.conflict}
    }

    preferencesRevision = step.revision
    commitments = {...commitments, savedStartDate: {date: startDate, revision: step.revision}}
  }

  const context: GenerationContext = run.planStartDate === null ? {kind: 'setup'} : {kind: 'nextWeek', startDate}

  collaborators.navigateToGenerating({
    context,
    idempotencyKey: collaborators.mintIdempotencyKey(),
    expectedPreferencesRevision: preferencesRevision,
    expectedTargetsRevision: targetsRevision,
    startDate
  })

  return {status: 'generating', commitments}
}
