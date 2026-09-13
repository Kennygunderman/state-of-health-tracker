import {FoodSourceEnum, PersonalFood, PersonalFoodSource} from '@data/models/Food'
import {FoodResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

// /api/foods is the personal-food endpoint: it stores only manual|label_scan|branded|seed and downgrades
// anything else to manual, so 'catalog' is resolved against this list too and falls back with every other
// unrecognised value. A row labelled catalog here would carry no catalog id to re-derive its numbers from,
// which is the claim the Food union exists to make impossible.
const KNOWN_SOURCES = Object.values(FoodSourceEnum).filter(
  (source): source is PersonalFoodSource => source !== FoodSourceEnum.CATALOG
) as string[]

export function convertFood(data: io.TypeOf<typeof FoodResponse>): PersonalFood {
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
