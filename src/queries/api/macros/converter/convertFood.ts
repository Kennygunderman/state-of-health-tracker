import {Food, FoodSourceEnum, PersonalFoodSource} from '@data/models/Food'
import {FoodResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

// 'catalog' is excluded because /api/foods is the personal-food endpoint and never returns it; like
// any other unrecognised value it falls back to manual.
const KNOWN_SOURCES = Object.values(FoodSourceEnum).filter(
  (source): source is PersonalFoodSource => source !== FoodSourceEnum.CATALOG
) as string[]

export function convertFood(data: io.TypeOf<typeof FoodResponse>): Food {
  return {
    id: data.id,
    name: data.name,
    servingAmount: data.servingAmount,
    servingUnit: data.servingUnit ?? null,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    brand: data.brand ?? null,
    source: KNOWN_SOURCES.includes(data.source) ? (data.source as PersonalFoodSource) : FoodSourceEnum.MANUAL
  }
}
