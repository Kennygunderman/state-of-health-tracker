import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {DislikedFoodLabelIndex, DislikedFoodSummary, TargetRoute} from '@data/models/MealPlanPreferences'

export interface WizardProgress {
  step: number
  totalSteps: number
}

// The manual-target route skips the calculation-only Activity step, so it counts one step fewer.
export const foodPreferencesWizardProgress = (targetRoute: TargetRoute | null): WizardProgress =>
  targetRoute === 'manual' ? {step: 4, totalSteps: 6} : {step: 5, totalSteps: 7}

export type SuggestionsViewState = 'loading' | 'unavailable' | 'ready'

// Suggestions are a shortcut, so losing them costs the user nothing else: the state resolves to a helper
// line rather than to anything that blocks the step, and the search field and Continue stay usable. The
// error branch is tested first because a query that has failed reports no data and must not read as loading.
export const resolveSuggestionsViewState = (isPending: boolean, isError: boolean): SuggestionsViewState => {
  if (isError) {
    return 'unavailable'
  }

  return isPending ? 'loading' : 'ready'
}

// Every name this step can put on a chip, from the three sources that can supply one. The flow's own index
// is the only one that can name a food staged from catalog search, because a dislikes save sends ids alone:
// until that save has landed and been refetched, nothing else in the app knows what the food is called.
// Where two sources name the same food the server's name wins, since it is the catalog's own.
export const buildDislikeLabelIndex = (
  staged: DislikedFoodLabelIndex,
  saved: readonly DislikedFoodSummary[],
  suggestions: readonly CatalogFoodSuggestion[]
): DislikedFoodLabelIndex => ({
  ...staged,
  ...Object.fromEntries(suggestions.map(food => [food.id, food])),
  ...Object.fromEntries(saved.map(food => [food.id, food]))
})

export interface SelectedDislikes {
  // The selected foods that can be named, in selection order — one chip each.
  readonly foods: DislikedFoodSummary[]
  // The size of the selection itself, which is what Continue persists. It is deliberately not
  // `foods.length`: reporting the number of chips instead would under-count a selection holding an id no
  // source can name, and the count the user reads has to be the count that gets saved.
  readonly count: number
}

export const buildSelectedDislikes = (
  selection: readonly string[],
  labels: DislikedFoodLabelIndex
): SelectedDislikes => ({
  foods: selection.flatMap(id => {
    const food = labels[id]

    return food === undefined ? [] : [food]
  }),
  count: selection.length
})

export interface FoodPreferencesControlsInput {
  isPreferencesPending: boolean
  isSavePending: boolean
  // Taken as an input so that the answer may be checked against it: the step is optional (47:338) and
  // suggestions are a shortcut to a selection the search field reaches anyway, so a failed suggestions
  // query must leave the step continuable.
  suggestionsState: SuggestionsViewState
}

export interface FoodPreferencesControls {
  isContinueDisabled: boolean
  isContinueLoading: boolean
}

export const resolveFoodPreferencesControls = ({
  isPreferencesPending,
  isSavePending
}: FoodPreferencesControlsInput): FoodPreferencesControls => ({
  // The save carries the row's revision, so it waits for the row and for nothing else.
  isContinueDisabled: isPreferencesPending,
  isContinueLoading: isSavePending
})
