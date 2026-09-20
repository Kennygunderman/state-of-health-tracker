import type {
  ManualNutritionTargetValues,
  NutritionTargetEstimate,
  NutritionTargetFeasibilityWarning,
  NutritionTargets,
  NutritionTargetsEditIntent,
  SaveEstimatedNutritionTargetsPayload,
  SaveNutritionTargetsPayload
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import {confirmedTargetValues, formatWholeNumber, hasAnyTargetValue} from '@utility/NutritionFormatUtility'
import {
  buildSaveEstimatedNutritionTargetsPayload,
  buildSaveManualNutritionTargetsPayload
} from '@utility/RevisionConflictUtility'

import {
  MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_FIELD_UNIT_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_TARGET_WARNING_LABELS,
  stringWithNamedParameters
} from '@constants/strings'

export interface EditTargetsFields {
  calories: string
  protein: string
  carbs: string
  fat: string
}

export type EditTargetsFieldKey = keyof EditTargetsFields

export type TargetFieldErrorCode = 'required' | 'not_a_number' | 'below_min' | 'above_max'

export type EditTargetsErrors = Partial<Record<EditTargetsFieldKey, TargetFieldErrorCode>>

export interface EditTargetsValidation {
  errors: EditTargetsErrors
  isValid: boolean
}

export type TargetsSaveSource = 'estimated' | 'manual'

// The route's own mode: 'manual' is the Skip / "Prefer not to say" entry with blank fields, 'setup' and 'edit'
// both open on figures that already exist somewhere (saved targets, or the estimate when none are saved).
export type EditTargetsMode = 'setup' | 'edit' | 'manual'

export interface EditTargetsIntentInputs {
  mode: EditTargetsMode
  // The intent the opening row stated, when it stated one: a Recalculate link sends 'confirm_estimate'. Absent
  // for a plain edit, which is resolved from the saved targets instead.
  routeIntent?: NutritionTargetsEditIntent
  targets: NutritionTargets | null
}

export interface TargetsSaveInputs {
  // Resolved by resolveEditTargetsIntent — the route, never a comparison of the numbers.
  intent: NutritionTargetsEditIntent
  fields: EditTargetsFields
  estimate: NutritionTargetEstimate | null
  // The targets the server holds, which supply both the revision a save pins and the values an unchanged save
  // is recognised by.
  targets: NutritionTargets | null
}

export type TargetsSaveDecision =
  | {kind: 'invalid'}
  | {kind: 'unchanged'}
  | {kind: 'save'; source: TargetsSaveSource; payload: SaveNutritionTargetsPayload}

export const CALORIES_MIN = 800

export const CALORIES_MAX = 6000

export const MACRO_MIN = 1

export const MACRO_MAX = 1000

interface TargetFieldBounds {
  min: number
  max: number
}

// A macro floor of 1 g is what makes the drawn carbs error ("Enter a carb target above 0 g") truthful:
// manual macros are stored exactly as entered and are never rebalanced against the calorie target, so a
// 0 g macro has to be rejected here rather than filled in for the user
const TARGET_FIELD_BOUNDS: Record<EditTargetsFieldKey, TargetFieldBounds> = {
  calories: {min: CALORIES_MIN, max: CALORIES_MAX},
  protein: {min: MACRO_MIN, max: MACRO_MAX},
  carbs: {min: MACRO_MIN, max: MACRO_MAX},
  fat: {min: MACRO_MIN, max: MACRO_MAX}
}

const TARGET_FIELD_KEYS: EditTargetsFieldKey[] = ['calories', 'protein', 'carbs', 'fat']

// The banner reads the same on every render because the presentation order is this list, not the order the
// server happened to return its warnings in
const FEASIBILITY_WARNING_ORDER: NutritionTargetFeasibilityWarning[] = [
  'macro_energy_mismatch',
  'below_catalog_min',
  'above_catalog_max'
]

const WARNING_SENTENCE_SEPARATOR = ' '

const WHOLE_NUMBER_PATTERN = /^\d+$/

const GROUP_SEPARATOR_PATTERN = /,/g

const REDUNDANT_LEADING_ZERO_PATTERN = /^0+(?=\d)/

const parseTargetValue = (text: string): number | null => {
  const trimmed = text.trim()

  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

/**
 * A stored target as the field opens on it.
 *
 * A member the server left unset becomes an empty field rather than '0': the four targets are independently
 * nullable, so a calories-only account must open with three blank macros and not three zeros, which
 * `validateEditTargets` would reject as below the minimum and which the user never chose. The rounding has to
 * match the one `resolveTargetsSaveSource` compares against — a field showing 1940 counts as holding an
 * estimate of 1940.4 — or confirming an untouched estimate would be demoted to a manual save.
 */
export const targetFieldText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(Math.round(value))

/**
 * The target as the field stores it: a bare whole number, no separators.
 *
 * Separators are removed before the digits are checked rather than after, because the field displays a grouped
 * figure (`targetFieldDisplayText`) and every edit of one arrives here mid-grouping: backspacing '1,940' gives
 * '1,94', an ordinary keystroke that a well-formed-grouping test would refuse, leaving the field unable to
 * delete its own last digit. What is still refused is an entry carrying anything but digits and separators — a
 * decimal point, a sign, prose — because dropping those characters would leave a perfectly valid target the
 * user never typed: '19.40' would be saved as 1940 and '-500' as 500, and neither `validateEditTargets` here
 * nor the server's integer bounds could tell that had happened. Callers pass the field's current value as
 * `previous` so a refused keystroke or paste keeps it.
 */
export const sanitizeIntegerInput = (text: string, previous: string = ''): string => {
  const entry = text.trim().replace(GROUP_SEPARATOR_PATTERN, '')

  if (entry === '') return ''

  if (!WHOLE_NUMBER_PATTERN.test(entry)) return previous

  return entry.replace(REDUNDANT_LEADING_ZERO_PATTERN, '')
}

/**
 * The stored target as the field presents it: grouped, so a saved 1940 reads '1,940' as 34:214 draws it.
 *
 * Grouping belongs here, at the render boundary, and never to the stored value: `resolveTargetsSaveSource`
 * recognises an untouched estimate by parsing the field, and a stored '1,940' parses to nothing, which would
 * demote a confirmation of the server's own figures to a manual save of numbers it never recomputed. An entry
 * holding no parseable figure is passed through unchanged, so a field mid-edit is never rewritten.
 */
export const targetFieldDisplayText = (value: string): string => {
  const parsed = parseTargetValue(value)

  return parsed === null ? value : formatWholeNumber(parsed)
}

/**
 * How many characters a field accepts, measured in the grouped presentation it displays.
 *
 * The limit is the wider of the field's own upper bound and the figure the field is currently showing, both
 * measured grouped. The bound is what stops a figure the server would refuse outright from being typed — and
 * measuring it on the bare number instead is a character short of every grouped bound, which stops the user
 * four characters into '1,940' and puts the drawn calorie target out of reach entirely.
 *
 * The displayed figure is the other half, and it is a required argument rather than an optional one because a
 * limit narrower than the field's own value is how a target the user never touched gets silently rewritten:
 * `PUT /api/user/targets` enforces no upper bound (0.1.3 keeps that route untouched), so a legacy or
 * third-party target of 10,000 or more opens a field six characters wide against a five-character limit. On
 * iOS `maxLength` gates edit events only; on Android it is an `InputFilter` that applies to programmatic text
 * as well, so the field would show a truncated '60,00' that `sanitizeIntegerInput` then reads back as 6,000 —
 * an order of magnitude below the stored figure, and a change the user never made. Widening the limit to the
 * value on screen keeps the whole figure visible and leaves `validateEditTargets` to refuse it on Save, which
 * names the real bound. The limit narrows again on its own as soon as the field holds a figure that fits.
 */
export const targetFieldMaxLength = (key: EditTargetsFieldKey, displayedText: string): number =>
  Math.max(targetFieldDisplayText(String(TARGET_FIELD_BOUNDS[key].max)).length, displayedText.length)

export type EditTargetsReadinessStatus = 'loading' | 'read_failed' | 'unavailable' | 'estimate_unavailable' | 'ready'

export interface EditTargetsReadinessInputs {
  // Which figures this screen is editing, from resolveEditTargetsIntent.
  intent: NutritionTargetsEditIntent
  isTargetsLoading: boolean
  // The targets route answered that it is not mounted: not a failure, and not something a retry can change.
  isTargetsRouteMissing: boolean
  hasTargetsReadFailure: boolean
  isEstimateLoading: boolean
  // The server answered that no estimate can be calculated for these inputs (409 estimate_unavailable).
  isEstimateUnavailable: boolean
  hasEstimateReadFailure: boolean
  // Whether the user has entered figures the screen must not discard.
  hasDraft: boolean
}

export interface EditTargetsReadiness {
  status: EditTargetsReadinessStatus
  // Whether the four fields are rendered at all.
  showFields: boolean
  // Whether "Save targets" may be pressed.
  canSave: boolean
  retryTargets: boolean
  retryEstimate: boolean
}

/**
 * Whether the editor is holding figures it can actually save, and what to render when it is not.
 *
 * Every state but 'ready' withholds the save, because this screen cannot write a target without the reads that
 * make the write meaningful: the payload pins the revision the targets read reports, and a confirmation also
 * pins the revision of the estimate it is confirming. A read that has not answered supplies neither, and an
 * editor that renders four blank fields over an unanswered read invites the user to type a target that is then
 * refused — or, worse, to save one against a revision that was never read.
 *
 * The four withholding states are distinct because the way out of each one differs:
 *
 * - 'unavailable' — the targets route is gone (a rolled-back backend). A retry answers identically until the
 *   backend rolls forward, so no retry is offered and the local target the user already had still stands.
 * - 'read_failed' — a genuine failure, which a retry can resolve, so one is offered for whichever read failed.
 * - 'loading' — a first read still in flight; the form waits rather than rendering blanks a resolved read
 *   would contradict.
 * - 'estimate_unavailable' — the estimate this visit exists to confirm cannot be calculated, so manual entry
 *   is the way out rather than a retry (0.2.5).
 *
 * `showFields` keeps a draft on screen through a failure. The editor refetches while recovering from a rejected
 * revision, and a refetch that fails must not take the user's entered figures down with it: with a draft the
 * fields stay, the banner explains, and only the save waits.
 *
 * The estimate is a requirement of one intent alone. A visit that opens on saved figures, or on the manual
 * route, treats it as the enhancement it is — it gates the Recalculate offer and nothing else — so a slow or
 * broken estimate never blocks an edit that does not depend on it.
 */
export const resolveEditTargetsReadiness = ({
  intent,
  isTargetsLoading,
  isTargetsRouteMissing,
  hasTargetsReadFailure,
  isEstimateLoading,
  isEstimateUnavailable,
  hasEstimateReadFailure,
  hasDraft
}: EditTargetsReadinessInputs): EditTargetsReadiness => {
  const requiresEstimate = intent === 'confirm_estimate'
  const withheld = {showFields: false, canSave: false, retryTargets: false, retryEstimate: false}

  if (isTargetsRouteMissing) {
    return {status: 'unavailable', ...withheld}
  }

  const estimateFailed = requiresEstimate && hasEstimateReadFailure

  if (hasTargetsReadFailure || estimateFailed) {
    return {
      status: 'read_failed',
      showFields: hasDraft,
      canSave: false,
      retryTargets: hasTargetsReadFailure,
      retryEstimate: estimateFailed
    }
  }

  if (isTargetsLoading || (requiresEstimate && isEstimateLoading)) {
    return {status: 'loading', ...withheld}
  }

  if (requiresEstimate && isEstimateUnavailable) {
    return {status: 'estimate_unavailable', ...withheld}
  }

  return {status: 'ready', showFields: true, canSave: true, retryTargets: false, retryEstimate: false}
}

export interface RecalculateOfferInputs {
  intent: NutritionTargetsEditIntent
  targets: NutritionTargets | null
  // Whether the estimate has actually loaded; it is an enhancement here, never a requirement.
  hasEstimate: boolean
}

/**
 * Whether to offer a recalculation of the saved figures this editor opened on.
 *
 * It is offered exactly where 0.5.2 calls the saved set one to review — its inputs have moved on since it was
 * confirmed, it was written outside the planner, or it is only partly filled — because those are the states the
 * planner either refuses or builds a plan from figures the user may no longer want. Without it a user who
 * arrived from Account, the diary or Plan settings can only retype the estimate by hand, and typing the
 * server's own figures saves them as a manual set, which is a different claim about where they came from.
 *
 * A visit already confirming the estimate needs no offer — its fields hold it — and the manual route has
 * nothing to recalculate against by definition.
 */
export const shouldOfferRecalculate = ({intent, targets, hasEstimate}: RecalculateOfferInputs): boolean =>
  hasEstimate &&
  intent === 'edit_saved' &&
  targets !== null &&
  (targets.stale || targets.source === 'legacy' || !targets.complete)

export interface TargetFieldLabelInputs {
  label: string
  // The spoken form of the unit, not the drawn suffix: a reader announces 'g' as a letter and 'kcal' as a
  // fragment.
  unitText: string
  // The message the field is reporting, when it is reporting one.
  errorMessage?: string
}

/**
 * How a target field is announced: the measurement it holds, the unit it is held in, and — when the field is
 * reporting one — the reason its value is refused.
 *
 * The unit belongs in the name because it is drawn inside the input rather than in the label, so 'Protein' on
 * its own leaves the user to guess grams from a percentage. An error extends that name instead of replacing it,
 * so a field reached after validation still announces both what it is and what is wrong with it.
 */
export const targetFieldAccessibilityLabel = ({label, unitText, errorMessage}: TargetFieldLabelInputs): string => {
  const named = stringWithNamedParameters(MEAL_PLAN_FIELD_UNIT_ACCESSIBILITY_TEMPLATE, {label, unit: unitText})

  return errorMessage === undefined
    ? named
    : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {label: named, message: errorMessage})
}

const validateTargetField = (value: string, bounds: TargetFieldBounds): TargetFieldErrorCode | null => {
  if (value.trim() === '') {
    return 'required'
  }

  const parsed = parseTargetValue(value)

  if (parsed === null) {
    return 'not_a_number'
  }

  if (parsed < bounds.min) {
    return 'below_min'
  }

  return parsed > bounds.max ? 'above_max' : null
}

export const validateEditTargets = (fields: EditTargetsFields): EditTargetsValidation => {
  const errors = TARGET_FIELD_KEYS.reduce<EditTargetsErrors>((accumulated, key) => {
    const error = validateTargetField(fields[key], TARGET_FIELD_BOUNDS[key])

    return error === null ? accumulated : {...accumulated, [key]: error}
  }, {})

  return {errors, isValid: Object.keys(errors).length === 0}
}

const parseFieldValues = (fields: EditTargetsFields): ManualNutritionTargetValues | null => {
  const calories = parseTargetValue(fields.calories)
  const protein = parseTargetValue(fields.protein)
  const carbs = parseTargetValue(fields.carbs)
  const fat = parseTargetValue(fields.fat)

  if (calories === null || protein === null || carbs === null || fat === null) {
    return null
  }

  return {calories, protein, carbs, fat}
}

const sameTargetValues = (left: ManualNutritionTargetValues, right: ManualNutritionTargetValues): boolean =>
  left.calories === right.calories &&
  left.protein === right.protein &&
  left.carbs === right.carbs &&
  left.fat === right.fat

// The estimate as this screen renders it — whole numbers — so a field showing 1,940 counts as holding an
// estimate of 1940.4.
const fieldsHoldEstimate = (fields: EditTargetsFields, estimate: NutritionTargetEstimate): boolean =>
  TARGET_FIELD_KEYS.every(key => parseTargetValue(fields[key]) === Math.round(estimate[key]))

const targetsRevisionOf = (targets: NutritionTargets | null): number => targets?.revision ?? NO_TARGETS_REVISION

/**
 * The body for an explicitly confirmed estimate, and null whenever this save is not one.
 *
 * Both conditions are required. The intent is what makes the save a confirmation: the user reached this screen
 * to recalculate, or the screen had no saved figures to show and therefore opened on the estimate. The numeric
 * match is what makes the claim true, because `source: 'estimated'` stores the server's own recomputed figures
 * — so claiming it for fields holding anything else would save numbers the user never saw.
 */
const estimatedConfirmationPayload = ({
  intent,
  fields,
  estimate,
  targets
}: TargetsSaveInputs): SaveEstimatedNutritionTargetsPayload | null =>
  intent === 'confirm_estimate' && estimate !== null && fieldsHoldEstimate(fields, estimate)
    ? buildSaveEstimatedNutritionTargetsPayload({
        estimateRevision: estimate.estimateRevision,
        targetsRevision: targetsRevisionOf(targets)
      })
    : null

/**
 * Which screen state the editor is in, from the route that opened it and the targets the server holds.
 *
 * `mode` is the stronger statement and wins: the manual route (Skip, or "Prefer not to say") opens on blank
 * fields with no estimate to confirm, whatever else a caller passes. Otherwise an explicit route intent — what
 * the review and settings rows send when their link reads Recalculate — is honoured, and the fallback reads the
 * state the screen will render: saved figures to edit, or the estimate when the server holds none.
 */
export const resolveEditTargetsIntent = ({
  mode,
  routeIntent,
  targets
}: EditTargetsIntentInputs): NutritionTargetsEditIntent => {
  if (mode === 'manual') {
    return 'manual_entry'
  }

  if (routeIntent !== undefined) {
    return routeIntent
  }

  // The same condition the review card applies when it decides whether to lead with the user's own figures.
  return hasAnyTargetValue(targets) ? 'edit_saved' : 'confirm_estimate'
}

/**
 * The source a save claims, derived from why the editor was opened rather than from what the numbers happen to
 * equal. Equality with the estimate only verifies an explicit confirmation (see estimatedConfirmationPayload);
 * it can never turn an edit into one, so a set entered by hand that coincides with the estimate stays manual
 * and an older estimate the user preserved is never re-declared as the current one.
 *
 * This answers the source question alone. `resolveTargetsSave` is what a screen calls, because it also reports
 * the saves that must not happen.
 */
export const resolveTargetsSaveSource = (inputs: TargetsSaveInputs): TargetsSaveSource =>
  estimatedConfirmationPayload(inputs) === null ? 'manual' : 'estimated'

/**
 * What pressing "Save targets" should do, with the body to send when it is a save.
 *
 * Four outcomes, decided in this order:
 *
 *  - 'invalid': a field holds nothing parseable. `validateEditTargets` is what the screen shows for that, and
 *    no request is built from it.
 *  - 'save' with source 'estimated': an explicit confirmation of the displayed estimate. It is decided before
 *    the unchanged case below, because confirming re-records which inputs the estimate came from — that is what
 *    clears a stale set even when the recalculated figures land on the same numbers.
 *  - 'unchanged': the fields still hold exactly the confirmed values the server already has. Saving them as
 *    manual would store the same numbers under a different ancestry and clear their staleness, which would hide
 *    the Recalculate affordance the user has not acted on — so nothing is sent and the screen simply returns.
 *  - 'save' with source 'manual': everything else, stored exactly as entered.
 */
export const resolveTargetsSave = (inputs: TargetsSaveInputs): TargetsSaveDecision => {
  const values = parseFieldValues(inputs.fields)

  if (values === null) {
    return {kind: 'invalid'}
  }

  const confirmation = estimatedConfirmationPayload(inputs)

  if (confirmation !== null) {
    return {kind: 'save', source: 'estimated', payload: confirmation}
  }

  const confirmed = confirmedTargetValues(inputs.targets)

  if (confirmed !== null && sameTargetValues(values, confirmed)) {
    return {kind: 'unchanged'}
  }

  return {
    kind: 'save',
    source: 'manual',
    payload: buildSaveManualNutritionTargetsPayload({values, targetsRevision: targetsRevisionOf(inputs.targets)})
  }
}

export const feasibilityBannerBody = (warnings: NutritionTargetFeasibilityWarning[]): string | null => {
  const sentences = FEASIBILITY_WARNING_ORDER.filter(code => warnings.includes(code)).map(
    code => MEAL_PLAN_TARGET_WARNING_LABELS[code]
  )

  return sentences.length === 0 ? null : sentences.join(WARNING_SENTENCE_SEPARATOR)
}
