import {MacroTotals} from './Macros'
import {MealSlot, RecipeBadge, RecipeIconKey} from './Recipe'

export type MealPlanStatus = 'active' | 'superseded'

/**
 * The plan lifecycle the server computes per request, which is what decides whether Swap and Log may be
 * offered. `MealPlanStatus` is the stored column and cannot answer that on its own: a plan whose last date has
 * passed stays 'active' in storage so its rows remain readable, and every write against it is refused
 * `409 plan_not_active {reason: 'ended'}`. 'active' here means active AND unfinished, in the user's own
 * calendar day.
 */
export type MealPlanLifecycle = 'active' | 'ended' | 'superseded'

// The runtime list behind the lenient resolution of a lifecycle arriving from the server, the way
// RECIPE_ICON_KEYS backs the icon fallback.
export const MEAL_PLAN_LIFECYCLES: MealPlanLifecycle[] = ['active', 'ended', 'superseded']

export type MealPlanFlagCode = 'diet' | 'allergen' | 'dislike' | 'cooking_time'

export interface MealPlanFlag {
  code: MealPlanFlagCode
  detail: string[]
}

export interface LoggedPlannedEntry {
  entryId: string
  // The diary date this entry landed on, which is not necessarily the planned date: a 'YYYY-MM-DD' day key,
  // validated by the decoder because the screens compare it against the plan's own dates.
  date: string
  mealName: string
  servings: number
  // A zone-bearing ISO instant, validated by the decoder: the entries of a slot are ordered by it, so the
  // latest is the one the card captions and "View in diary" opens.
  loggedAt: string
  recipeVersionId: string
  recipeName: string
}

export interface PlannedRecipeSummary {
  versionId: string
  recipeId: string
  name: string
  iconKey: RecipeIconKey
  totalMinutes: number
  badges: RecipeBadge[]
  nutritionProvenance: 'source_backed'
}

export interface PreviousRecipeSummary {
  versionId: string
  name: string
}

export interface MealPlanSummary {
  plannedMeals: number
  groceryItemCount: number
  loggedEntryCount: number
}

export interface MealPlanMeal {
  id: string
  revision: number
  slot: MealSlot
  // A zero-padded 24-hour 'HH:mm' wall-clock time, validated by the decoder.
  slotTime: string
  sortOrder: number
  recipe: PlannedRecipeSummary
  portionMultiplier: number
  portionText: string
  planned: MacroTotals
  flags: MealPlanFlag[]
  previousRecipe: PreviousRecipeSummary | null
  // A list, not one nullable link: a deliberate second serving of the same meal is its own diary entry. Ordered
  // by loggedAt (a timestamp, unlike each entry's day-key date) ascending, so the latest entry is the last one.
  loggedEntries: LoggedPlannedEntry[]
}

export interface MealPlanDay {
  id: string
  // A 'YYYY-MM-DD' day key in the user's stored time zone, validated by the decoder: it is compared
  // lexicographically against the plan's range and passed as a route parameter.
  date: string
  dayIndex: number
  plannedTotals: MacroTotals
  isLastDay: boolean
  meals: MealPlanMeal[]
}

export interface MealPlan {
  id: string
  revision: number
  generationAttempt: number
  /**
   * The idempotency key of the keyed write that published this plan — the one field that can prove a plan
   * belongs to a request this client still holds unresolved.
   *
   * After a generation whose response was lost, a refetched plan may be the one that request committed, one
   * another device made, or the plan it was about to replace; dates and revisions cannot tell them apart.
   * Comparing this against the pending key is the exact test, so the intent is retired on a match and kept on
   * anything else (0.2.5, 0.7.2).
   */
  generationKey: string
  // 'YYYY-MM-DD' day keys, endDate six days after startDate. Validated by the decoder, because every date
  // bound in the plan — the day strip, the next week's start, the log screen's range — is derived from them.
  startDate: string
  endDate: string
  status: MealPlanStatus
  // Three members rather than one: targets is what the user's targets are now, generationTargets is the snapshot
  // this plan was built against, and targetsStale is their inequality. Nothing regenerates on its own, so a plan
  // outliving its targets has to stay both readable and captionable.
  targets: MacroTotals
  generationTargets: MacroTotals
  targetsStale: boolean
  preferencesRevision: number
  targetsRevision: number
  hasIncompatibilities: boolean
  summary: MealPlanSummary
  days: MealPlanDay[]
}

export interface CurrentMealPlans {
  current: MealPlan | null
  upcoming: MealPlan | null
}

/**
 * One day read on its own, with the plan facts the screens built on it need.
 *
 * `isWritable` is the ONLY member Swap and Log may be gated on. `planStatus` is the stored column, and it
 * reads 'active' for a week that finished last month — gating on it offers two actions the server answers
 * `409 plan_not_active` on. `planLifecycle` is why the verdict is what it is, for copy that has to distinguish
 * a finished week from a replaced plan.
 *
 * BOTH ARE `null` WHEN NO SERVER VERDICT IS IN HAND. A verdict is a server-computed value and nothing else:
 * endedness is judged against the calendar day of the user's SAVED IANA zone, which the app does not hold and
 * which the AAP keeps as a home zone until their next preferences save — so after travel the device's day and
 * the saved zone's day disagree, and a client deriving the verdict locally would offer writes the server
 * refuses `409 plan_not_active {reason: 'ended'}`. The envelope the day query seeds from the cached week
 * therefore carries `null` here: its `day` is real content to render, and its writeability is simply unknown
 * until `GET .../days/:date` answers. Gate on `isWritable === true`, never on truthiness, so an unknown
 * verdict neither offers a write nor claims the plan is dead.
 */
export interface MealPlanDayEnvelope {
  planId: string
  planRevision: number
  planStatus: MealPlanStatus
  planLifecycle: MealPlanLifecycle | null
  isWritable: boolean | null
  day: MealPlanDay
}

// One row of the affected-meals response: the flagged meals of an active plan, flat rather than nested in the
// plan tree, because Plan settings names them in a banner without loading the days they belong to.
export interface AffectedMeal {
  mealId: string
  // A 'YYYY-MM-DD' day key, validated by the decoder: the settings banner selects the earliest flagged day
  // from these by comparing them.
  date: string
  slot: MealSlot
  recipeName: string
  flags: MealPlanFlag[]
}
