import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {DislikedFoodLabelIndex, DislikedFoodSummary} from '@data/models/MealPlanPreferences'

import {
  buildDislikeLabelIndex,
  buildSelectedDislikes,
  foodPreferencesWizardProgress,
  resolveFoodPreferencesControls,
  resolveSuggestionsViewState,
  SuggestionsViewState
} from '../index.util'

const MUSHROOM: DislikedFoodSummary = {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'}

const OLIVE: DislikedFoodSummary = {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}

// The food that only the flow can name: staged from catalog search, so the saved row has never been told
// about it and it appears in no suggestions list.
const ANCHOVY: DislikedFoodSummary = {id: 'food-anchovy', name: 'Anchovies', foodGroup: 'fish'}

const BROCCOLI: CatalogFoodSuggestion = {id: 'food-broccoli', name: 'Broccoli', foodGroup: 'brassica'}

const labelIndex = (...foods: DislikedFoodSummary[]): DislikedFoodLabelIndex =>
  Object.fromEntries(foods.map(food => [food.id, food]))

describe('foodPreferencesWizardProgress', () => {
  it('reads as the fifth step of seven on the calculated-target route', () => {
    expect(foodPreferencesWizardProgress('estimated')).toEqual({step: 5, totalSteps: 7})
  })

  it('reads as the fourth step of six on the manual-target route, which skips Activity', () => {
    expect(foodPreferencesWizardProgress('manual')).toEqual({step: 4, totalSteps: 6})
  })

  it('reads as the calculated route while the route is still unknown', () => {
    expect(foodPreferencesWizardProgress(null)).toEqual({step: 5, totalSteps: 7})
  })
})

describe('resolveSuggestionsViewState', () => {
  it('shows the placeholder cloud while the suggestions load', () => {
    expect(resolveSuggestionsViewState(true, false)).toBe('loading')
  })

  it('shows the chips once they are loaded', () => {
    expect(resolveSuggestionsViewState(false, false)).toBe('ready')
  })

  // The step needs no suggestion to be answerable: search and Continue are unaffected, so a failure resolves
  // to the helper line and never to a blocked step.
  it('reports the suggestions unavailable when the query failed', () => {
    expect(resolveSuggestionsViewState(false, true)).toBe('unavailable')
  })

  it('reports a failure as unavailable rather than as still loading', () => {
    expect(resolveSuggestionsViewState(true, true)).toBe('unavailable')
  })
})

describe('buildDislikeLabelIndex', () => {
  it('names a food that only the flow knows about, which is the whole point of the index', () => {
    const merged = buildDislikeLabelIndex(labelIndex(ANCHOVY), [], [])

    expect(merged['food-anchovy']).toEqual(ANCHOVY)
  })

  it('merges all three sources rather than taking the first that answers', () => {
    const merged = buildDislikeLabelIndex(labelIndex(ANCHOVY), [MUSHROOM], [BROCCOLI])

    expect(Object.keys(merged).sort()).toEqual(['food-anchovy', 'food-broccoli', 'food-mushroom'])
  })

  it('prefers the saved row over the flow where both name the same food', () => {
    const stale = labelIndex({...MUSHROOM, name: 'Mushrooms'})
    const merged = buildDislikeLabelIndex(stale, [MUSHROOM], [])

    expect(merged['food-mushroom'].name).toBe('Mushrooms, white')
  })

  it('prefers the saved row over the suggestions list where both name the same food', () => {
    const merged = buildDislikeLabelIndex({}, [{...BROCCOLI, name: 'Broccoli, raw'}], [BROCCOLI])

    expect(merged['food-broccoli'].name).toBe('Broccoli, raw')
  })

  it('is empty when no source can name anything', () => {
    expect(buildDislikeLabelIndex({}, [], [])).toEqual({})
  })
})

describe('buildSelectedDislikes', () => {
  it('puts one chip on screen for every selected food, in selection order', () => {
    const selected = buildSelectedDislikes(
      ['food-mushroom', 'food-olive'],
      buildDislikeLabelIndex({}, [MUSHROOM, OLIVE], [])
    )

    expect(selected.foods).toEqual([MUSHROOM, OLIVE])
    expect(selected.count).toBe(2)
  })

  // Nothing but the flow's own index can name a food staged from catalog search, and a selection Continue
  // saves has to be one the user can see and remove.
  it('shows a food staged from search, so it can be reviewed and removed on this screen', () => {
    const selected = buildSelectedDislikes(
      ['food-mushroom', 'food-anchovy'],
      buildDislikeLabelIndex(labelIndex(ANCHOVY), [MUSHROOM], [])
    )

    expect(selected.foods.map(food => food.name)).toEqual(['Mushrooms, white', 'Anchovies'])
    expect(selected.count).toBe(2)
  })

  it('names a selected suggestion from the suggestions list', () => {
    const selected = buildSelectedDislikes(['food-broccoli'], buildDislikeLabelIndex({}, [], [BROCCOLI]))

    expect(selected.foods).toEqual([BROCCOLI])
  })

  // The count is what Continue would persist, so it counts the selection and not the chips: an id no source
  // can name is still saved, and reporting the chip count would tell the user a smaller number than the one
  // being sent.
  it('counts the selection rather than the chips when a food cannot be named', () => {
    const selected = buildSelectedDislikes(['food-mushroom', 'food-unknown'], labelIndex(MUSHROOM))

    expect(selected.count).toBe(2)
    expect(selected.foods).toEqual([MUSHROOM])
  })

  it('reports nothing selected for an empty selection', () => {
    expect(buildSelectedDislikes([], labelIndex(MUSHROOM))).toEqual({foods: [], count: 0})
  })

  it('ignores names for foods that are not selected', () => {
    const selected = buildSelectedDislikes(['food-olive'], labelIndex(MUSHROOM, OLIVE, ANCHOVY))

    expect(selected.foods).toEqual([OLIVE])
  })

  it('derives the same result from the same input', () => {
    const labels = buildDislikeLabelIndex(labelIndex(ANCHOVY), [MUSHROOM], [BROCCOLI])
    const selection = ['food-anchovy', 'food-mushroom']

    expect(buildSelectedDislikes(selection, labels)).toEqual(buildSelectedDislikes(selection, labels))
  })
})

describe('resolveFoodPreferencesControls', () => {
  const READY = {isPreferencesPending: false, isSavePending: false, suggestionsState: 'ready' as const}

  it('holds Continue back only until the row its save must carry a revision of has arrived', () => {
    expect(resolveFoodPreferencesControls({...READY, isPreferencesPending: true})).toEqual({
      isContinueDisabled: true,
      isContinueLoading: false
    })
  })

  it('reports the save in flight without disabling the button, so the press shows its spinner', () => {
    expect(resolveFoodPreferencesControls({...READY, isSavePending: true})).toEqual({
      isContinueDisabled: false,
      isContinueLoading: true
    })
  })

  // Nothing on this step is required (47:338) and the search field reaches the same selection, so losing the
  // suggestions costs the user the chips and nothing else: the step stays continuable in every one of its
  // states, including the failed one.
  it.each<SuggestionsViewState>(['loading', 'unavailable', 'ready'])(
    'leaves the step continuable whatever the suggestions query reports (%s)',
    suggestionsState => {
      expect(resolveFoodPreferencesControls({...READY, suggestionsState})).toEqual({
        isContinueDisabled: false,
        isContinueLoading: false
      })
    }
  )
})
