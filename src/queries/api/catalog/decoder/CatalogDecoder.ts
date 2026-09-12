import {PaginationResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

// Mirrors state-of-health-be's src/types/catalog.ts response shapes.
const nullableNumber = io.union([io.number, io.null])

export const CatalogFoodResponse = io.type({
  id: io.string,
  name: io.string,
  category: io.string,
  foodState: io.string,
  identitySource: io.string,
  nutritionProvenance: io.string,
  nutritionBasis: io.string,
  basisAmount: io.number,
  calories: io.number,
  protein: io.number,
  carbs: io.number,
  fat: io.number,
  fiber: nullableNumber,
  defaultPortion: io.type({
    description: io.string,
    amount: io.number,
    unit: io.string,
    gramWeight: io.number
  }),
  allergenTags: io.array(io.string),
  allergenStatus: io.string,
  foodGroup: io.string
})

export const CatalogSuggestionResponse = io.type({
  id: io.string,
  name: io.string,
  foodGroup: io.string
})

export const CatalogSearchResponse = io.type({
  items: io.array(CatalogFoodResponse),
  pagination: PaginationResponse
})

export const CatalogSuggestionsResponse = io.type({
  items: io.array(CatalogSuggestionResponse)
})
