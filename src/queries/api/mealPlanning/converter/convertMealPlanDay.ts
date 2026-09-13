import {MealPlanDay, MealPlanFlag, MealPlanFlagCode, MealPlanMeal} from '@data/models/MealPlan'
import {RECIPE_BADGES, RECIPE_ICON_KEYS, RecipeBadge, RecipeIconKey} from '@data/models/Recipe'
import {MealPlanDayResponse, MealPlanMealResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_FLAG_CODES: MealPlanFlagCode[] = ['diet', 'allergen', 'dislike', 'cooking_time']
const KNOWN_ICON_KEYS = RECIPE_ICON_KEYS as string[]
const KNOWN_BADGES = RECIPE_BADGES as string[]

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
    portionText: data.portionText,
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
    plannedTotals: data.plannedTotals,
    isLastDay: data.isLastDay,
    meals: data.meals.map(convertMealPlanMeal)
  }
}
