import crashlytics from '@react-native-firebase/crashlytics'
import type * as io from 'io-ts'

// The marker that makes recording idempotent. A non-enumerable own property, so it never reaches JSON.stringify
// and never shows up in a spread of an error-shaped object.
const RECORDED_FLAG = '__sohRecorded'

// How much of a decode failure is worth reporting. Enough paths to recognise which part of a response drifted,
// and a hard stop so one malformed array cannot turn into a report of every element in it.
const MAX_REPORTED_PATHS = 8
const UNNAMED_CODEC = 'unknown'
const ROOT_PATH = '(root)'

interface RecordedMarker {
  [RECORDED_FLAG]?: boolean
}

// The flag is an OWN property this module wrote with `Object.defineProperty` below, so a flag reached through
// a prototype is by definition not one of ours. Reading it as a plain member would resolve the chain, and a
// single polluted `Object.prototype.__sohRecorded` would then make every error look already reported and
// silence every crash report this app makes. `Object.prototype.hasOwnProperty.call` rather than
// `error.hasOwnProperty(...)`: the argument is an untrusted rejected value that may shadow or lack that
// method. Same guard, same reason as `TextUtility.hasOwnEntry`.
const isRecorded = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  Object.prototype.hasOwnProperty.call(error, RECORDED_FLAG) &&
  (error as RecordedMarker)[RECORDED_FLAG] === true

const markRecorded = (error: unknown): void => {
  if (typeof error !== 'object' || error === null) {
    return
  }

  Object.defineProperty(error, RECORDED_FLAG, {value: true, enumerable: false, configurable: true})
}

/**
 * Where in a response a codec failed, and what it expected there — the two things that identify a contract
 * break — with nothing of what the response actually contained.
 *
 * io-ts reports each failure as a context chain, and EVERY link of that chain carries an `actual`: at the root
 * it is the whole decoded body, and at each step the parent object that held the failing member. Serialising
 * the chain therefore serialises the payload, which for this app means meal names, calorie targets, dates,
 * diary entry ids and portions. Only the keys and the expected type names are read here; `actual` is never
 * touched, so no field value can leave the device through this path (CWE-532).
 */
export function describeDecodeFailure(errors: io.Errors): string {
  const paths = errors.map(error => {
    const path = error.context
      .map(entry => entry.key)
      .filter(key => key.length > 0)
      .join('.')
    const expected = error.context[error.context.length - 1]?.type?.name ?? UNNAMED_CODEC

    return `${path.length > 0 ? path : ROOT_PATH}: expected ${expected}`
  })

  const unique = paths.filter((path, index) => paths.indexOf(path) === index)
  const reported = unique.slice(0, MAX_REPORTED_PATHS)
  const omitted = unique.length - reported.length

  return omitted > 0 ? `${reported.join('; ')}; +${omitted} more` : reported.join('; ')
}

// A static route word: lowercase letters in single hyphen- or underscore-separated groups, no digits, and short
// enough that no encoded value can pass as one. `meal-planning`, `uncheck-all`, `weigh-ins` and `targets_manual`
// match; a uuid, a hex token, `2026-09-18` and `v2` do not.
const STATIC_ROUTE_WORD = /^[a-z]+(?:[-_][a-z]+)*$/
const MAX_ROUTE_WORD_LENGTH = 32

// The value shapes this app puts in a path, each named by what it is so a report reads as a route template.
const PATH_VALUE_PLACEHOLDERS: readonly {readonly pattern: RegExp; readonly placeholder: string}[] = [
  {pattern: /^\d{4}-\d{2}-\d{2}$/, placeholder: ':date'},
  {pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, placeholder: ':id'},
  {pattern: /^\d+$/, placeholder: ':n'}
]

// Anything that is neither a recognised value shape nor a static route word. Deliberately last and deliberately
// unconditional: an unrecognised segment is redacted, never reported and reasoned about afterwards.
const OPAQUE_PLACEHOLDER = ':param'

const describePathSegment = (segment: string): string => {
  if (segment.length === 0) {
    return segment
  }

  const matched = PATH_VALUE_PLACEHOLDERS.find(({pattern}) => pattern.test(segment))

  if (matched !== undefined) {
    return matched.placeholder
  }

  return segment.length <= MAX_ROUTE_WORD_LENGTH && STATIC_ROUTE_WORD.test(segment) ? segment : OPAQUE_PLACEHOLDER
}

/**
 * The ROUTE a failure happened at — the templated form, never the URL that was actually requested.
 *
 * A concrete URL is request data, and in this app request data is health data. `GET /api/macros/2026-09-18`
 * says which day a person opened their diary; `PUT /api/macros/entry/<uuid>` and
 * `GET /api/meal-planning/plans/<uuid>/days/<date>` carry stable record identifiers that re-identify the row
 * across reports and join telemetry back to a diary entry. Dropping the query string is not enough: it only
 * removes the catalog search term, and the ids and dates live in the path.
 *
 * So the origin and the query are dropped and every remaining segment is classified. A segment is reported
 * verbatim ONLY if it is a static route word; anything else becomes a typed placeholder, which leaves a route
 * an engineer can act on (`GET /api/meal-planning/plans/:id/days/:date`) and a value nobody can recover.
 *
 * FAIL-CLOSED, AND WHY THAT IS THE SAFE DIRECTION. The verbatim test is an allowlist by shape, not a denylist
 * of things that look like ids: lowercase letters with single internal hyphens or underscores and no digits at
 * all. Every id this app puts in a path is a `@db.Uuid` (foods, meals, meal_entries, meal_plans,
 * meal_plan_meals, grocery_items, recipe_versions), so no record id can reach the verbatim class — and an
 * opaque, hex or alphanumeric identifier a future endpoint introduces is redacted by default rather than
 * leaked while nobody is looking. The cost of the same rule is that a new route word is reported as `:param`
 * until it is recognised, which loses precision in a crash report and never loses privacy.
 *
 * The one dynamic segment that stays verbatim is a wizard step name (`goal`, `cooking`, `targets_manual`):
 * that names WHICH step failed, which is route identity in the same sense as `groceries` or `swap`, and says
 * nothing about the answer the user gave there.
 */
export function describeEndpoint(url: string): string {
  const [withoutFragment] = url.split('#')
  const [withoutQuery] = withoutFragment.split('?')
  // The origin is configuration rather than user data, but it is not route identity either, so it goes: an
  // absolute URL keeps everything from the first slash of its path onward.
  const originMatch = withoutQuery.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i)
  const path = originMatch === null ? withoutQuery : (originMatch[1] ?? '/')

  return path
    .split('/')
    .map(segment => describePathSegment(segment))
    .join('/')
}

export default class CrashUtility {
  /**
   * Reports an error once. A second call with the same error object does nothing, so a request function that
   * catches, records and rethrows cannot double-report a failure its transport already reported — and the
   * sanitised version of a decode failure can never be followed by a raw one.
   */
  public static recordError(error: unknown) {
    if (isRecorded(error)) {
      return
    }

    markRecorded(error)
    // Cast rather than narrowed: a rejected value is not always an Error — a string or a plain object reaches
    // here from a native module or a JSON body — and Crashlytics' own typing takes an Error. Dropping the
    // non-Error ones instead would silence exactly the failures nobody expected.
    crashlytics().recordError(error as Error)
  }

  /**
   * Builds, reports and returns the error for a response that failed its codec.
   *
   * The single place a decode failure becomes an Error, so the bound on what it may say holds for every
   * endpoint at once: the method, the endpoint path, and the codec paths that failed. The returned error is
   * already marked as recorded, so the caller throws it and every catch block above re-records nothing.
   */
  public static recordDecodeFailure(method: string, url: string, errors: io.Errors): Error {
    const error = new Error(`Decoding failed for ${method} ${describeEndpoint(url)}: ${describeDecodeFailure(errors)}`)

    CrashUtility.recordError(error)

    return error
  }
}
