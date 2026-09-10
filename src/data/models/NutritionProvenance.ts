export type NutritionProvenance = 'source_backed' | 'ingredient_derived' | 'ai_estimated' | 'user_entered'

export type SourcedNutritionProvenance = Exclude<NutritionProvenance, 'user_entered'>
