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
   * The idempotency key of the keyed write that published this plan, or `null` when the response carried none.
   *
   * NULLABLE BECAUSE IT IS NOT A CONTRACT MEMBER. The plan contract (0.5.2) does not declare it; the server
   * sends it as an additive extra, so the codec admits a response without it and the converter lands that as
   * `null` rather than failing a whole week of meals over a member nothing promised.
   *
   * WHAT MAY BE CONCLUDED FROM IT. Only the screen that owns a pending generation may use it, and only to
   * recognise its own result and stop waiting (0.7.4). An ordinary plan read never retires a pending intent —
   * a refetch is display-only and only a server answer to the same key resolves it (0.2.5) — so a comparison
   * against `null` is simply "not proven", which is also what every comparison must fall back to.
   */
  generationKey: string | null
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
 * reads 'active' for a week that finished last month — gating on it alone offers two actions the server
 * answers `409 plan_not_active` on. `planLifecycle` is why the verdict is what it is, for copy that has to
 * distinguish a finished week from a replaced plan.
 *
 * WHERE THE VERDICT COMES FROM. Preferably from the day response, which computes it against the calendar day
 * of the user's SAVED IANA zone — the zone their last preferences save stored, which the app does not hold, so
 * after travel the device's day and that zone's day disagree and only the server can judge a finished week.
 * Those two members are additive extras rather than contract members (0.5.2), though, so
 * `convertMealPlanDayEnvelope` falls back to the contract's own `planStatus` when they are absent: a
 * superseded plan is then read-only, and a finished-but-stored-'active' week offers the write and is refused
 * `409 plan_not_active {reason: 'ended'}`, which the screens already recover from by refetching and saying so.
 *
 * BOTH ARE `null` WHEN NO ENVELOPE HAS ANSWERED AT ALL — the envelope the day query seeds from the cached week
 * carries `null` here: its `day` is real content to render, and its writeability is simply unknown until
 * `GET .../days/:date` answers. Gate on `isWritable === true`, never on truthiness, so an unknown verdict
 * neither offers a write nor claims the plan is dead.
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
