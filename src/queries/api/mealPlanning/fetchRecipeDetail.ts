import {RecipeVersion} from '@data/models/Recipe'
import {convertRecipeVersion} from '@queries/api/mealPlanning/converter/convertRecipeVersion'
import {RecipeVersionResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchRecipeDetail(recipeVersionId: string): Promise<RecipeVersion> {
  try {
    const response = await httpGet(Endpoints.RecipeVersion(recipeVersionId), RecipeVersionResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching recipe: status=${response?.status}`)
    }

    return convertRecipeVersion(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
