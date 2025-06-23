import {USDA_BASE_URL, USDA_FOOD_API_KEY} from '@env'
import FoodItem, {caloriesFromMacros, Macros} from '@store/food/models/FoodItem'
import axios from 'axios'
import {Either, isLeft} from 'fp-ts/lib/Either'
import * as io from 'io-ts'
import {Errors} from 'io-ts'
import {isNil} from 'lodash'

import CrashUtility from '../../utility/CrashUtility'
import {capitalizeFirstLetterOfEveryWord} from '../../utility/TextUtility'

interface IFoodSearchService {
  searchBrandedFoods: (searchQuery: string, numToLoad: number, onFetched: (foods: FoodItem[]) => void) => void
  getFoodItem: (fdcId: number, onFetched: (foodItem?: FoodItem) => void) => void
}

const SearchFoodItemNutrient = io.partial({
  nutrientName: io.string,
  value: io.number,
  nutrientNumber: io.string
})

const SearchFoodItemResponse = io.partial({
  fdcId: io.number,
  brandName: io.union([io.string, io.null]),
  brandOwner: io.union([io.string, io.null]),
  description: io.union([io.string, io.null]),
  servingSize: io.union([io.number, io.null]),
  servingSizeUnit: io.union([io.string, io.null]),
  householdServingFullText: io.union([io.string, io.null]),
  foodNutrients: io.union([io.array(SearchFoodItemNutrient), io.null])
})

const SearchFoodResponse = io.partial({
  foods: io.array(SearchFoodItemResponse)
})

const BrandedFoodLabelNutrientResponse = io.type({
  value: io.number
})

const BrandedFoodLabelNutrientsResponse = io.partial({
  protein: io.union([BrandedFoodLabelNutrientResponse, io.null]),
  carbohydrates: io.union([BrandedFoodLabelNutrientResponse, io.null]),
  fat: io.union([BrandedFoodLabelNutrientResponse, io.null]),
  calories: io.union([BrandedFoodLabelNutrientResponse, io.null])
})

const BrandedFoodResponse = io.partial({
  fdcId: io.number,
  brandName: io.union([io.string, io.null]),
  brandOwner: io.union([io.string, io.null]),
  brandedFoodCategory: io.union([io.string, io.null]),
  ingredients: io.union([io.string, io.null]),
  labelNutrients: io.union([BrandedFoodLabelNutrientsResponse, io.null]),
  householdServingFullText: io.union([io.string, io.null]),
  servingSize: io.union([io.number, io.null]),
  servingSizeUnit: io.union([io.string, io.null])
})

class FoodSearchService implements IFoodSearchService {
  searchBrandedFoods(searchQuery: string, numToLoad: number, onFetched: (foods: FoodItem[]) => void): void {
    const options = {
      method: 'GET',
      url: `${USDA_BASE_URL}/foods/search`,
      params: {
        query: searchQuery,
        dataType: 'Branded',
        pageSize: numToLoad,
        pageNumber: 1,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
        api_key: USDA_FOOD_API_KEY
      }
    }

    axios
      .request(options)
      .then(({data}: {data: any}) => {
        const decode = (decoded: object) => SearchFoodResponse.decode(decoded)
        const decodedData: Either<Errors, any> = decode(data)

        if (isLeft(decodedData)) {
          // decode failed
          CrashUtility.recordError(Error(`Error searching foods ${decodedData.left}`))
          onFetched([])

          return
        }

        const foodItems: FoodItem[] = []

        decodedData.right.foods.forEach((foodResponse: any) => {
          if (
            !isNil(foodResponse.fdcId) &&
            !isNil(foodResponse.brandName) &&
            !isNil(foodResponse.brandOwner) &&
            !isNil(foodResponse.description) &&
            !isNil(foodResponse.servingSize) &&
            !isNil(foodResponse.servingSizeUnit) &&
            !isNil(foodResponse.foodNutrients)
          ) {
            let servingSize = ''

            if (!isNil(foodResponse.householdServingFullText) && foodResponse.householdServingFullText !== '') {
              servingSize = `(${capitalizeFirstLetterOfEveryWord(foodResponse.householdServingFullText)})`
            } else if (!isNil(foodResponse.servingSize) && !isNil(foodResponse.servingSizeUnit)) {
              servingSize = `(${foodResponse.servingSize} ${foodResponse.servingSizeUnit})`
            }

            const values = this.getValuesForFoodSearchItem(foodResponse.servingSize, foodResponse.foodNutrients)

            if (isNil(values)) {
              return
            }

            foodItems.push({
              id: foodResponse.fdcId,
              name: `${capitalizeFirstLetterOfEveryWord(foodResponse.description)} ${servingSize}`,
              description: `${capitalizeFirstLetterOfEveryWord(foodResponse.brandName)}, ${foodResponse.brandOwner}`,
              servings: 1,
              calories: values.calories,
              macros: values.macros,
              source: 'remote'
            })
          }
        })

        onFetched(foodItems)
      })
      .catch((error: any) => {
        CrashUtility.recordError(error)
        onFetched([])
      })
  }

  private getValuesForFoodSearchItem(
    servingSize: number,
    nutrients: any[]
  ):
    | {
        calories: number
        macros: Macros
      }
    | undefined {
    const protein = nutrients.find(nutrient => nutrient.nutrientNumber === '203')
    const carbs = nutrients.find(nutrient => nutrient.nutrientNumber === '205')
    const fat = nutrients.find(nutrient => nutrient.nutrientNumber === '204')

    // USDA calculates values per 100g or 100ml from values per serving.
    const modifider = servingSize / 100

    if (isNil(protein) || isNil(carbs) || isNil(fat)) {
      return undefined
    }

    const macros: Macros = {
      protein: Math.round(modifider * (protein?.value ?? 0)),
      carbs: Math.round(modifider * (carbs?.value ?? 0)),
      fat: Math.round(modifider * (fat?.value ?? 0))
    }

    return {
      calories: caloriesFromMacros(macros),
      macros
    }
  }

  getFoodItem(fdcId: number, onFetched: (foodItem?: FoodItem) => void) {
    const options = {
      method: 'GET',
      url: `${USDA_BASE_URL}/food/${fdcId}`,
      params: {
        format: 'full',
        nutrients: 203,
        api_key: USDA_FOOD_API_KEY
      }
    }

    axios
      .request(options)
      .then(({data}: {data: any}) => {
        const decode = (decoded: object) => BrandedFoodResponse.decode(decoded)
        const decodedData: Either<Errors, any> = decode(data)

        if (isLeft(decodedData)) {
          // decode failed
          CrashUtility.recordError(Error(`Error fetching food data ${decodedData.left}`))

          return
        }

        const foodData = decodedData.right

        if (
          !isNil(foodData.fdcId) &&
          !isNil(foodData.brandName) &&
          !isNil(foodData.brandOwner) &&
          !isNil(foodData.description)
        ) {
          let servingSize = ''

          if (!isNil(foodData.householdServingFullText) && foodData.householdServingFullText !== '') {
            servingSize = `(${capitalizeFirstLetterOfEveryWord(foodData.householdServingFullText)})`
          } else if (!isNil(foodData.servingSize) && !isNil(foodData.servingSizeUnit)) {
            servingSize = `(${foodData.servingSize} ${foodData.servingSizeUnit})`
          }

          onFetched({
            id: foodData.fdcId.toString(),
            name: `${capitalizeFirstLetterOfEveryWord(foodData.description)} ${servingSize}`,
            description: `${capitalizeFirstLetterOfEveryWord(foodData.brandName)}, ${foodData.brandOwner}`,
            ingredients: capitalizeFirstLetterOfEveryWord(foodData.ingredients ?? ''),
            calories: foodData.labelNutrients.calories.value ?? 0,
            servings: 1,
            macros: {
              protein: foodData.labelNutrients.protein.value ?? 0,
              carbs: foodData.labelNutrients.carbohydrates.value ?? 0,
              fat: foodData.labelNutrients.fat.value ?? 0
            }
          })
        } else {
          CrashUtility.recordError(Error(`Error decoding food data: ${foodData}`))
          onFetched(undefined)
        }
      })
      .catch((error: any) => {
        CrashUtility.recordError(error)
        onFetched(undefined)
      })
  }
}

const foodSearchService = new FoodSearchService() as IFoodSearchService

export default foodSearchService
