import * as io from 'io-ts'

const optionalString = io.union([io.string, io.null, io.undefined])

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,9})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/
const TIME_ZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9+_-]*(\/[A-Za-z0-9+_-]+){0,2}$/
const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

// Month length comes from the Gregorian rules rather than from a Date, so '2026-02-30' is refused and
// '2024-02-29' is accepted without consulting a clock, a zone or a locale. This mirrors the server's own
// isCalendarDayKey, which is what decides whether a day key was accepted in the first place.
const isCalendarDayKey = (value: string): boolean => {
  if (!DAY_KEY_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)

  if (month < 1 || month > 12 || day < 1) return false

  return day <= (month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1])
}

// Zero-padded and 24-hour, so '24:00' and '8:00' are both refused — the two forms the server never emits.
const isClockTime = (value: string): boolean => CLOCK_TIME_PATTERN.test(value)

// An instant, not a local date-time: the zone designator is required, because these values are compared
// and ordered, and 'YYYY-MM-DDTHH:mm:ss' alone names no point in time. Date.parse is consulted last so a
// pattern-shaped but unrepresentable value is still refused.
const isTimestamp = (value: string): boolean => {
  const match = TIMESTAMP_PATTERN.exec(value)

  return match !== null && isCalendarDayKey(match[1]) && Number.isFinite(Date.parse(value))
}

// A RangeError means the engine knows time zones and does not know this one. Any other failure is the
// engine's, not the value's, so it is not read as a verdict on the name.
const engineKnowsTimeZone = (name: string): boolean => {
  try {
    return new Intl.DateTimeFormat('en-US', {timeZone: name}).resolvedOptions().timeZone.length > 0
  } catch (error) {
    return !(error instanceof RangeError)
  }
}

// Whether this engine carries a time-zone database it can reject an unknown name with. Nothing else in the
// app uses Intl, so an engine without one degrades to the shape check below rather than refusing every
// response that carries a zone.
const ENGINE_REJECTS_UNKNOWN_TIME_ZONES = !engineKnowsTimeZone('Not/AZone')

const isTimeZoneName = (value: string): boolean =>
  TIME_ZONE_NAME_PATTERN.test(value) && (!ENGINE_REJECTS_UNKNOWN_TIME_ZONES || engineKnowsTimeZone(value))

// A string the server promised a format for, refined rather than branded: the decoded type stays `string`,
// so every consumer keeps the type it has today and httpRequest's `io.Type<T>` contract still holds, while
// a malformed value is refused at the boundary instead of reaching date parsing, ordering or navigation.
const formattedString = (name: string, isValid: (value: string) => boolean): io.Type<string> =>
  new io.Type<string>(
    name,
    (input): input is string => typeof input === 'string' && isValid(input),
    (input, context) => (typeof input === 'string' && isValid(input) ? io.success(input) : io.failure(input, context)),
    io.identity
  )

// The shared wire-format and nullability primitives of the API layer. They live beside MacroTotalsResponse
// and PaginationResponse because this is the module the meal-planning and catalog decoders already take
// their shared codecs from, so one definition serves all three.
export const NullableNumber = io.union([io.number, io.null])

export const NullableString = io.union([io.string, io.null])

export const DayKeyString = formattedString('DayKeyString', isCalendarDayKey)

export const NullableDayKeyString = io.union([DayKeyString, io.null])

export const ClockTimeString = formattedString('ClockTimeString', isClockTime)

export const TimestampString = formattedString('TimestampString', isTimestamp)

export const NullableTimeZoneString = io.union([formattedString('TimeZoneString', isTimeZoneName), io.null])

export const MacroTotalsResponse = io.type({
  calories: io.number,
  protein: io.number,
  carbs: io.number,
  fat: io.number
})

export const MacroTargetsResponse = io.type({
  calories: NullableNumber,
  protein: NullableNumber,
  carbs: NullableNumber,
  fat: NullableNumber
})

export const MealEntryResponse = io.intersection([
  io.type({
    id: io.string,
    foodId: optionalString,
    name: io.string,
    servingText: optionalString,
    servings: io.number,
    calories: io.number,
    protein: io.number,
    carbs: io.number,
    fat: io.number,
    // inputMethod stays a loose string on purpose: the server owns the vocabulary and an older client has
    // to keep decoding a method it has never heard of, so the converter resolves it with a named fallback.
    inputMethod: io.string,
    loggedAt: TimestampString
  }),
  // null on legacy diary rows; absent when the server predates meal planning
  io.partial({
    mealPlanMealId: NullableString,
    nutritionProvenance: NullableString
  })
])

export const MealResponse = io.type({
  id: io.string,
  name: io.string,
  sortOrder: io.number,
  entries: io.array(MealEntryResponse),
  totals: MacroTotalsResponse
})

export const DailyMacrosResponse = io.type({
  date: DayKeyString,
  meals: io.array(MealResponse),
  totals: MacroTotalsResponse,
  targets: MacroTargetsResponse
})

export const FoodResponse = io.type({
  id: io.string,
  name: io.string,
  servingAmount: io.number,
  servingUnit: optionalString,
  calories: io.number,
  protein: io.number,
  carbs: io.number,
  fat: io.number,
  brand: optionalString,
  source: io.string
})

export const PaginationResponse = io.type({
  page: io.number,
  limit: io.number,
  total: io.number,
  totalPages: io.number
})
