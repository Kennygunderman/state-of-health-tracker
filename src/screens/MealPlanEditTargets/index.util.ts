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
import {confirmedTargetValues, hasAnyTargetValue} from '@utility/NutritionFormatUtility'
import {
  buildSaveEstimatedNutritionTargetsPayload,
  buildSaveManualNutritionTargetsPayload
} from '@utility/RevisionConflictUtility'

import {MEAL_PLAN_TARGET_WARNING_LABELS} from '@constants/strings'

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

// '1,940' and '10,000' are group separators inside a whole number; '1,94' and '19,4000' are not a number at
// all, so the separator is only presentation where the grouping itself is well formed.
const GROUPED_WHOLE_NUMBER_PATTERN = /^\d{1,3}(,\d{3})+$/

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
 * Only presentation is removed — surrounding space, well-formed group separators and a redundant leading
 * zero, so NutritionFormatUtility is the one place a stored value is re-grouped for display. An entry carrying
 * anything else (a decimal point, a sign, prose, a malformed group) is refused and `previous` is returned
 * unchanged, because deleting those characters would leave a perfectly valid target the user never typed:
 * '19.40' would be saved as 1940 and '-500' as 500, and neither `validateEditTargets` here nor the server's
 * integer bounds could tell that had happened. Callers pass the field's current value as `previous` so a
 * refused keystroke or paste keeps it.
 */
export const sanitizeIntegerInput = (text: string, previous: string = ''): string => {
  const entry = text.trim()

  if (entry === '') return ''

  if (!WHOLE_NUMBER_PATTERN.test(entry) && !GROUPED_WHOLE_NUMBER_PATTERN.test(entry)) return previous

  return entry.replace(GROUP_SEPARATOR_PATTERN, '').replace(REDUNDANT_LEADING_ZERO_PATTERN, '')
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
