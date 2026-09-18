import {
  MealPlanDay,
  MealPlanDayEnvelope,
  MealPlanFlag,
  MealPlanFlagCode,
  MealPlanMeal,
  MealPlanStatus
} from '@data/models/MealPlan'
import {RECIPE_BADGES, RECIPE_ICON_KEYS, RecipeBadge, RecipeIconKey} from '@data/models/Recipe'
import {
  MealPlanDayEnvelopeResponse,
  MealPlanDayResponse,
  MealPlanMealResponse
} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {resolveEnvelopeWriteability} from '@utility/MealPlanLifecycleUtility'
import * as io from 'io-ts'

const KNOWN_FLAG_CODES: MealPlanFlagCode[] = ['diet', 'allergen', 'dislike', 'cooking_time']
const KNOWN_ICON_KEYS = RECIPE_ICON_KEYS as string[]
const KNOWN_BADGES = RECIPE_BADGES as string[]
const KNOWN_PLAN_STATUSES = ['active', 'superseded'] as const
// An unrecognised status reads as the replaced plan rather than the live one, so a value this build has no
// word for leaves the day read-only instead of offering writes the server would refuse.
const UNRECOGNISED_PLAN_STATUS: MealPlanStatus = 'superseded'
const ACTIVE_PLAN_STATUS: MealPlanStatus = 'active'

export function convertMealPlanMeal(data: io.TypeOf<typeof MealPlanMealResponse>): MealPlanMeal {
  return {
    id: data.id,
    revision: data.revision,
    // Carried, never defaulted: the slot decides which card and which diary bucket this meal belongs to,
    // and the codec admits only the four the contract defines.
    slot: data.slot,
    slotTime: data.slotTime,
    sortOrder: data.sortOrder,
    recipe: {
      versionId: data.recipe.versionId,
      recipeId: data.recipe.recipeId,
      name: data.recipe.name,
      // A glyph is the one code worth guessing at: an unknown one renders the generic bowl rather than
      // failing a whole plan over an icon.
      iconKey: KNOWN_ICON_KEYS.includes(data.recipe.iconKey) ? (data.recipe.iconKey as RecipeIconKey) : 'bowl',
      totalMinutes: data.recipe.totalMinutes,
      badges: data.recipe.badges.filter((badge): badge is RecipeBadge => KNOWN_BADGES.includes(badge)),
      // Planning admits source-backed recipes only, which the codec now enforces as a literal, so this is
      // the server's own claim rather than an assertion made on its behalf.
      nutritionProvenance: data.recipe.nutritionProvenance
    },
    // Passed through unrounded: the swap commit echoes it back and the server re-derives it (409 preview_stale).
    portionMultiplier: data.portionMultiplier,
    // Rendered verbatim: it is already in the recipe's own serving unit ('1 bowl', '1¼ plates'), composed
    // server-side from the multiplier and the recipe's serving description.
    portionText: data.portionText,
    // Passed through as sent: the server display-rounds every planned figure at the wire boundary, so these
    // are already the integers the card shows. Rounding here would be a second rounding site.
    planned: data.planned,
    // An unrecognised code is dropped, not remapped: substituting one would assert an advisory the server never sent.
    flags: data.flags
      .filter((flag): flag is MealPlanFlag => (KNOWN_FLAG_CODES as string[]).includes(flag.code))
      .map(flag => ({code: flag.code, detail: flag.detail})),
    previousRecipe: data.previousRecipe
      ? {versionId: data.previousRecipe.versionId, name: data.previousRecipe.name}
      : null,
    // Kept in the server's order (loggedAt ascending, then entryId) because the screens derive logged state from it.
    loggedEntries: data.loggedEntries.map(entry => ({
      entryId: entry.entryId,
      date: entry.date,
      mealName: entry.mealName,
      servings: entry.servings,
      loggedAt: entry.loggedAt,
      recipeVersionId: entry.recipeVersionId,
      recipeName: entry.recipeName
    }))
  }
}

export function convertMealPlanDay(data: io.TypeOf<typeof MealPlanDayResponse>): MealPlanDay {
  return {
    id: data.id,
    date: data.date,
    dayIndex: data.dayIndex,
    // Already display-rounded by the server, like each meal's `planned`.
    plannedTotals: data.plannedTotals,
    isLastDay: data.isLastDay,
    meals: data.meals.map(convertMealPlanMeal)
  }
}

/**
 * The GET .../days/:date envelope as the screens read it, including the writeability verdict Swap and Log are
 * gated on.
 *
 * WHY THE VERDICT IS RESOLVED HERE. The envelope's contract is `{planId, planRevision, planStatus, day}`
 * (0.5.2); `planLifecycle` and `isWritable` are additive extras this server sends but the contract does not
 * promise, so the mapping needs one rule for both cases and that rule has to be testable — which a branch
 * written inside a request function would not be.
 *
 * WITH THE EXTRAS: the server's own judgement is used, made in the calendar day of the user's SAVED IANA zone,
 * which the app does not hold and so cannot reproduce. `resolveEnvelopeWriteability` takes their conjunction,
 * so an unrecognised lifecycle and an explicit `isWritable: false` both close the door.
 *
 * WITHOUT THEM: the contract's own `planStatus` answers instead — a superseded plan is read-only, and an
 * active one offers the write. That leaves exactly one case the client cannot see, a week whose last date has
 * passed while its stored status is still 'active' (0.5.1), and it is the case the plan's own refusal covers:
 * the write is answered `409 plan_not_active {reason: 'ended'}`, the screens report it and refetch. Guessing
 * endedness from the device's day instead would be wrong in the other direction, because a plan already over
 * in the user's saved zone can still be current on the device's.
 */
export function convertMealPlanDayEnvelope(data: io.TypeOf<typeof MealPlanDayEnvelopeResponse>): MealPlanDayEnvelope {
  const planStatus = (KNOWN_PLAN_STATUSES as readonly string[]).includes(data.planStatus)
    ? (data.planStatus as MealPlanStatus)
    : UNRECOGNISED_PLAN_STATUS
  const writeability = resolveEnvelopeWriteability(
    data.planLifecycle ?? planStatus,
    data.isWritable ?? planStatus === ACTIVE_PLAN_STATUS
  )

  return {
    planId: data.planId,
    planRevision: data.planRevision,
    planStatus,
    planLifecycle: writeability.lifecycle,
    isWritable: writeability.isWritable,
    day: convertMealPlanDay(data.day)
  }
}
