import {SOH_API_BASE_URL} from '@env'

// Host comes from the environment: local .env for `expo run`, EAS environment
// variables for builds (development/preview → dev API, production → prod).
// Fallback keeps release builds safe if the var is ever missing — it survives
// only there, because the preflight below rejects it under __DEV__ and Jest so
// a debug build or a test run can never silently reach production data.
const resolvedApiOrigin = SOH_API_BASE_URL || 'https://stateofhealthapi.com'

const baseApiUrl = `${resolvedApiOrigin}/api`

// react-native-dotenv only exposes the names allowlisted in babel.config.js, so
// an extra development host is added here rather than to the environment.
const SOH_DEV_API_HOSTS: string[] = []

// Compared on a label boundary, so a host that merely contains "ngrok" fails.
const NGROK_HOST_SUFFIXES = ['.ngrok.io', '.ngrok-free.app', '.ngrok.app', '.ngrok.dev']

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1']

const PRINTABLE_ASCII_ONLY = /^[\x21-\x7e]+$/
const HTTP_SCHEME = /^https?:\/\//i
const BARE_AUTHORITY = /^([a-z0-9._-]+)(?::(\d{1,5}))?$/i
const TRAILING_DOT = /\.$/
const DNS_LABEL = /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/i
// No leading zeros, because a URL parser re-reads 010 as octal 8 and 0x0a as
// hex 10 — only the plain decimal form means what it says.
const DECIMAL_OCTET = /^(?:0|[1-9]\d{0,2})$/

const MIN_PORT = 1
const MAX_PORT = 65535
const MAX_OCTET = 255
const IPV4_LABEL_COUNT = 4
const MAX_HOST_LENGTH = 253
const MAX_LABEL_LENGTH = 63

type Ipv4Octets = [number, number, number, number]

interface ParsedOrigin {
  host: string
  octets: Ipv4Octets | null
}

const parseIpv4Octets = (labels: string[]): Ipv4Octets | null => {
  if (labels.length !== IPV4_LABEL_COUNT || !labels.every(label => DECIMAL_OCTET.test(label))) {
    return null
  }

  const octets = labels.map(Number)

  if (octets.some(octet => octet > MAX_OCTET)) {
    return null
  }

  return [octets[0], octets[1], octets[2], octets[3]]
}

const parseHost = (host: string): ParsedOrigin | null => {
  const labels = host.split('.')

  // A host whose last label is numeric is an IPv4 address to every URL parser,
  // so it must be a full dotted quad here and is never treated as a name.
  if (NUMERIC_LABEL.test(labels[labels.length - 1])) {
    const octets = parseIpv4Octets(labels)

    return octets ? {host, octets} : null
  }

  if (host.length > MAX_HOST_LENGTH) {
    return null
  }

  const isDnsName = labels.every(label => label.length <= MAX_LABEL_LENGTH && DNS_LABEL.test(label))

  return isDnsName ? {host, octets: null} : null
}

// Anything this cannot read as scheme + host + optional port is rejected rather
// than normalized: a backslash, userinfo, a control character or a non-ASCII
// label separator each move the host the request stack resolves, so agreeing
// with that stack means accepting only hosts no character can shift. Surrounding
// whitespace is rejected for the same reason and never trimmed — baseApiUrl is
// built from the raw value, and String.trim() strips more (U+00A0, U+2028) than
// a URL parser does, so trimming here would approve a string no request can use.
const parseOrigin = (origin: string): ParsedOrigin | null => {
  if (!PRINTABLE_ASCII_ONLY.test(origin) || !HTTP_SCHEME.test(origin)) {
    return null
  }

  const authority = BARE_AUTHORITY.exec(origin.replace(HTTP_SCHEME, ''))

  if (!authority) {
    return null
  }

  const [, hostPart, portPart] = authority
  const port = portPart ? Number(portPart) : MIN_PORT

  if (port < MIN_PORT || port > MAX_PORT) {
    return null
  }

  const host = hostPart.toLowerCase().replace(TRAILING_DOT, '')

  return host === '' ? null : parseHost(host)
}

// RFC 1918: 10/8, 172.16/12 and 192.168/16.
const isPrivateIpv4 = ([first, second]: Ipv4Octets): boolean =>
  first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)

export const isNonProductionApiOrigin = (origin: string): boolean => {
  const parsed = parseOrigin(origin)

  if (!parsed) {
    return false
  }

  if (LOOPBACK_HOSTS.includes(parsed.host) || SOH_DEV_API_HOSTS.includes(parsed.host)) {
    return true
  }

  if (parsed.octets) {
    return isPrivateIpv4(parsed.octets)
  }

  return NGROK_HOST_SUFFIXES.some(suffix => parsed.host.endsWith(suffix))
}

const MALFORMED_ORIGIN_MESSAGE =
  'SOH_API_BASE_URL is not a bare http(s) origin. Expected http(s)://host[:port] with no path, credentials or query. The configured value is not logged.'

const PRODUCTION_ORIGIN_MESSAGE =
  'SOH_API_BASE_URL must point at a non-production API in development and tests. Allowed: localhost, 127.0.0.1, a private LAN address, an *.ngrok* tunnel or a SOH_DEV_API_HOSTS entry. The configured value is not logged.'

// The origin is a parameter because `module:react-native-dotenv` inlines
// SOH_API_BASE_URL at every reference site and deletes the `@env` import, so a
// test cannot drive these branches by mocking the module. Nothing derived from
// the rejected value is interpolated into these messages: this throws at module
// load, so it reaches Jest, Metro and CI logs, and a misconfigured value can
// carry credentials or a token — even its host, which may be the token itself.
export const assertNonProductionApiOrigin = (origin: string | undefined): void => {
  if (!origin || origin.trim() === '') {
    throw new Error('SOH_API_BASE_URL is not set')
  }

  if (!parseOrigin(origin)) {
    throw new Error(MALFORMED_ORIGIN_MESSAGE)
  }

  if (!isNonProductionApiOrigin(origin)) {
    throw new Error(PRODUCTION_ORIGIN_MESSAGE)
  }
}

export const assertNonProductionApi = (): void => {
  assertNonProductionApiOrigin(SOH_API_BASE_URL)
}

if (__DEV__ || typeof jest !== 'undefined') {
  assertNonProductionApi()
}

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  Exercise: `${baseApiUrl}/exercise/`,
  Template: `${baseApiUrl}/template/`,
  Workout: `${baseApiUrl}/workout/`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
  WeeklyWorkoutSummary: `${baseApiUrl}/workouts/weekly-summary/7`,
  ExerciseTemplates: `${baseApiUrl}/templates`,
  User: `${baseApiUrl}/user`,
  UserAvatar: `${baseApiUrl}/user/avatar`,
  Records: `${baseApiUrl}/records`,
  ExerciseHistory: (exerciseId: string) => `${baseApiUrl}/exercises/${exerciseId}/history`,
  Run: `${baseApiUrl}/run/`,
  Runs: `${baseApiUrl}/runs`,
  WeighIn: `${baseApiUrl}/weigh-in/`,
  WeighIns: `${baseApiUrl}/weigh-ins`,
  DailyMacros: (date: string) => `${baseApiUrl}/macros/${date}`,
  MacrosHistory: `${baseApiUrl}/macros/history`,
  MacroMealEntries: (mealId: string) => `${baseApiUrl}/macros/meal/${mealId}/entries`,
  MacroEntry: (entryId: string) => `${baseApiUrl}/macros/entry/${entryId}`,
  MacroEstimate: `${baseApiUrl}/macros/estimate`,
  AiUsage: `${baseApiUrl}/macros/ai-usage`,
  MacroLabelScan: `${baseApiUrl}/macros/label-scan`,
  MacroTargets: `${baseApiUrl}/user/targets`,
  Foods: `${baseApiUrl}/foods`,
  Food: (foodId: string) => `${baseApiUrl}/foods/${foodId}`,
  BrandedFoodSearch: (query: string) => `${baseApiUrl}/macros/search-branded-foods?q=${encodeURIComponent(query)}`,
  MealPlanPreferences: `${baseApiUrl}/meal-planning/preferences`,
  MealPlanPreferenceStep: (step: string) => `${baseApiUrl}/meal-planning/preferences/steps/${step}`,
  MealPlanTargets: `${baseApiUrl}/meal-planning/targets`,
  MealPlanTargetEstimate: `${baseApiUrl}/meal-planning/targets/estimate`,
  MealPlans: `${baseApiUrl}/meal-planning/plans`,
  CurrentMealPlan: `${baseApiUrl}/meal-planning/plans/current`,
  MealPlanDay: (planId: string, date: string) => `${baseApiUrl}/meal-planning/plans/${planId}/days/${date}`,
  RegenerateMealPlan: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/regenerate`,
  MealPlanAffectedMeals: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/affected-meals`,
  MealPlanSwapAlternatives: (planId: string, mealId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/alternatives`,
  MealPlanSwapPreview: (planId: string, mealId: string, recipeVersionId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/alternatives/${recipeVersionId}/preview`,
  MealPlanSwap: (planId: string, mealId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/swap`,
  MealPlanGroceries: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/groceries`,
  MealPlanGroceryItem: (planId: string, itemId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/groceries/${itemId}`,
  MealPlanGroceriesUncheckAll: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/groceries/uncheck-all`,
  LogPlannedMeal: (planId: string, mealId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/log`,
  RecipeVersion: (recipeVersionId: string) => `${baseApiUrl}/recipes/${recipeVersionId}`,
  CatalogFoodSearch: (query: string, page: number, limit: number) =>
    `${baseApiUrl}/catalog/foods?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
  CatalogFoodSuggestions: (kind: 'dislike', limit: number) =>
    `${baseApiUrl}/catalog/foods/suggestions?kind=${encodeURIComponent(kind)}&limit=${limit}`,
  CatalogStatus: `${baseApiUrl}/catalog/status`
}

export default Endpoints
