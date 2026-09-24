export type NutritionProvenance = 'source_backed' | 'ingredient_derived' | 'ai_estimated' | 'user_entered'

export type SourcedNutritionProvenance = Exclude<NutritionProvenance, 'user_entered'>

// The members of the type above as data, so a parser checking restored or stored values against the union has
// one list to consult rather than its own copy of the spellings.
export const SOURCED_NUTRITION_PROVENANCES: readonly SourcedNutritionProvenance[] = [
  'source_backed',
  'ingredient_derived',
  'ai_estimated'
]
