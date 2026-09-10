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
 * Decides how a rejected revisioned save recovers, given the draft the user submitted and the
 * freshly refetched resource. Only the listed fields the draft actually carries are compared, so
 * an edit made elsewhere to an untouched field is never a conflict.
 *
 * Equal values resolve silently, which covers both a matching edit from another device and this
 * client's own first attempt having been written before its response was lost — neither may
 * surface a conflict prompt or produce a second write.
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
