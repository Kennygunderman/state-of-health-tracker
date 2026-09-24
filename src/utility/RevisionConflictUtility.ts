import type {
  ManualNutritionTargetValues,
  SaveEstimatedNutritionTargetsPayload,
  SaveManualNutritionTargetsPayload
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'

export type RevisionResolution = {status: 'resolved'} | {status: 'conflict'; conflictingFields: string[]}

const readField = (source: object, field: string): unknown => (source as Record<string, unknown>)[field]

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPrimitiveArray = (values: readonly unknown[]): boolean =>
  values.every(value => typeof value !== 'object' && typeof value !== 'function')

const haveSameMembers = (left: readonly unknown[], right: readonly unknown[]): boolean => {
  const remaining = new Map<unknown, number>()

  for (const value of left) {
    remaining.set(value, (remaining.get(value) ?? 0) + 1)
  }

  for (const value of right) {
    const count = remaining.get(value) ?? 0

    if (count === 0) {
      return false
    }

    remaining.set(value, count - 1)
  }

  return true
}

const areArraysEqual = (left: readonly unknown[], right: readonly unknown[]): boolean => {
  if (left.length !== right.length) {
    return false
  }

  // Selections such as allergens and disliked food ids carry no wire order, so arrays of
  // primitives compare as multisets; mealTimes holds one entry per slot in a fixed order, so
  // any array carrying objects (or nulls) compares element-wise instead.
  if (isPrimitiveArray(left) && isPrimitiveArray(right)) {
    return haveSameMembers(left, right)
  }

  return left.every((value, index) => areValuesEqual(value, right[index]))
}

const areRecordsEqual = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every(
    key => Object.prototype.hasOwnProperty.call(right, key) && areValuesEqual(left[key], right[key])
  )
}

const areValuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true
  }

  if (left === null || right === null) {
    return false
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && areArraysEqual(left, right)
  }

  if (isPlainRecord(left) && isPlainRecord(right)) {
    return areRecordsEqual(left, right)
  }

  return false
}

/**
 * A refetch as the caller receives it. `isSuccess` is required rather than optional because it is the whole
 * point of the shape: a caller that passed `data` alone would be handing over a row the read no longer stands
 * behind. Both a `QueryObserverResult` (what `refetch()` resolves with) and a `useQuery` result satisfy it
 * without a cast.
 */
export interface RefetchedResourceRead<T> {
  isSuccess: boolean
  data?: T | undefined
}

/**
 * The refetched row, and only when the refetch actually reached the server.
 *
 * This is the gate `resolveStaleRevision` depends on and cannot enforce for itself. AAP 0.7.2 requires a
 * rejected revisioned save to be recovered against "the authoritative resource", and TanStack deliberately
 * keeps the last successful `data` on a result whose refetch failed — so `refetched.data` after a failed
 * refetch is the row the client already held *before* it pressed, not the server's answer. Comparing the draft
 * with that row inverts the recovery: the two match precisely because nothing was re-read, the helper reports
 * `resolved`, and the screen advances as proof that a refused write had landed — discarding whatever another
 * device (or this client's own earlier attempt) actually stored.
 *
 * `null` therefore means "no authoritative answer", which covers the failed refetch and the resource that
 * genuinely holds no row. Both leave the caller in the same position — nothing may be concluded, the draft is
 * kept, and the press is reported as failed — so they need no distinction here.
 */
export const authoritativeRefetch = <T>(refetched: RefetchedResourceRead<T>): T | null =>
  refetched.isSuccess ? (refetched.data ?? null) : null

/**
 * Decides how a rejected revisioned save recovers, given the draft the user submitted and the
 * freshly refetched resource. Only the listed fields the draft actually carries are compared, so
 * an edit made elsewhere to an untouched field is never a conflict.
 *
 * Equal values resolve silently, which covers both a matching edit from another device and this
 * client's own first attempt having been written before its response was lost — neither may
 * surface a conflict prompt or produce a second write.
 *
 * `fresh` must be an authoritative answer — obtain it with `authoritativeRefetch`, which is where the reason
 * is written down. A retained pre-press row passed in here resolves silently for the wrong reason and lets a
 * refused write read as committed.
 */
export const resolveStaleRevision = <T extends object>(
  draft: Partial<T>,
  fresh: T,
  fields: readonly (keyof T & string)[]
): RevisionResolution => {
  const conflictingFields = fields.filter(field => {
    const drafted = readField(draft, field)

    if (drafted === undefined || !Object.prototype.hasOwnProperty.call(draft, field)) {
      return false
    }

    return !areValuesEqual(drafted, readField(fresh, field))
  })

  if (conflictingFields.length > 0) {
    return {status: 'conflict', conflictingFields}
  }

  return {status: 'resolved'}
}

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
