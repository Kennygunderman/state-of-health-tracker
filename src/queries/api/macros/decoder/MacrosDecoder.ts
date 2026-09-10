import * as io from 'io-ts'

const optionalString = io.union([io.string, io.null, io.undefined])
const nullableNumber = io.union([io.number, io.null])

export const MacroTotalsResponse = io.type({
  calories: io.number,
  protein: io.number,
  carbs: io.number,
  fat: io.number
})

export const MacroTargetsResponse = io.type({
  calories: nullableNumber,
  protein: nullableNumber,
  carbs: nullableNumber,
  fat: nullableNumber
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
    inputMethod: io.string,
    loggedAt: io.string
  }),
  // Present and explicitly null on entries the server wrote before meal
  // planning shipped; absent entirely from a server that predates the columns.
  // nutritionProvenance decodes as a loose string so an unrecognised future
  // value cannot fail the whole response — the converter narrows it.
  io.partial({
    mealPlanMealId: optionalString,
    nutritionProvenance: optionalString
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
  date: io.string,
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
