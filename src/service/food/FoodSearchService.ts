import axios from 'axios';
import { Either, isLeft } from 'fp-ts/lib/Either';
import * as io from 'io-ts';
import { Errors } from 'io-ts';
import { isNil } from 'lodash';
import { USDA_BASE_URL, USDA_FOOD_API_KEY } from '../../../config';
import FoodItem from '../../store/food/models/FoodItem';
import { capitalizeFirstLetterOfEveryWord } from '../../utility/TextUtility';

export interface SearchFoodItem {
    fdcId: number;
    brandName: string;
    brandOwner: string;
    description: string;
}

export interface BrandedFoodItem {
    fdcId: number;
    brandName: string;
    brandOwner: string;
    description: string;
    protein: number;
    carbs: number;
    fat: number;
    ingredients?: string;
    brandedFoodCategory?: string;
}

interface IFoodSearchService {
    searchBrandedFoods: (searchQuery: string, onFetched: (foods: SearchFoodItem[]) => void) => void;
    getFoodItem: (fdcId: number, onFetched: (foodItem?: FoodItem) => void) => void;
}

const SearchFoodItemResponse = io.partial({
    fdcId: io.number,
    brandName: io.union([io.string, io.null]),
    brandOwner: io.union([io.string, io.null]),
    description: io.union([io.string, io.null]),
});

const SearchFoodResponse = io.partial({
    foods: io.array(SearchFoodItemResponse),
});

const BrandedFoodLabelNutrientResponse = io.type({
    value: io.number,
});

const BrandedFoodLabelNutrientsResponse = io.partial({
    protein: io.union([BrandedFoodLabelNutrientResponse, io.null]),
    carbohydrates: io.union([BrandedFoodLabelNutrientResponse, io.null]),
    fat: io.union([BrandedFoodLabelNutrientResponse, io.null]),
    calories: io.union([BrandedFoodLabelNutrientResponse, io.null]),
});

const BrandedFoodResponse = io.partial({
    fdcId: io.number,
    brandName: io.union([io.string, io.null]),
    brandOwner: io.union([io.string, io.null]),
    brandedFoodCategory: io.union([io.string, io.null]),
    ingredients: io.union([io.string, io.null]),
    labelNutrients: io.union([BrandedFoodLabelNutrientsResponse, io.null]),
    householdServingFullText: io.union([io.string, io.null]),
    servingSize: io.union([io.number, io.null]),
    servingSizeUnit: io.union([io.string, io.null]),
});

class FoodSearchService implements IFoodSearchService {
    searchBrandedFoods(searchQuery: string, onFetched: (foods: SearchFoodItem[]) => void): void {
        const options = {
            method: 'GET',
            url: `${USDA_BASE_URL}/foods/search`,
            params: {
                query: searchQuery,
                dataType: 'Branded',
                pageSize: 30,
                pageNumber: 1,
                sortBy: 'dataType.keyword',
                sortOrder: 'asc',
                api_key: USDA_FOOD_API_KEY,
            },
        };

        axios
            .request(options)
            .then(({ data }: { data: any }) => {
                const decode = (decoded: object) => SearchFoodResponse.decode(decoded);
                const decodedData: Either<Errors, any> = decode(data);
                if (isLeft(decodedData)) {
                    // decode failed
                    // TODO: report error to crashlytics
                    onFetched([]);
                    return;
                }

                const foodItems: SearchFoodItem[] = [];
                decodedData.right.foods.forEach((foodResponse: any) => {
                    if (!isNil(foodResponse.fdcId)
                        && !isNil(foodResponse.brandName)
                        && !isNil(foodResponse.brandOwner)
                        && !isNil(foodResponse.description)) {
                        foodItems.push({
                            fdcId: foodResponse.fdcId,
                            brandName: foodResponse.brandName,
                            brandOwner: foodResponse.brandOwner,
                            description: capitalizeFirstLetterOfEveryWord(foodResponse.description),
                        });
                    }
                });

                onFetched(foodItems);
            })
            .catch((error: any) => {
                console.error(error);
                // TODO: report error to crashlytics
                onFetched([]);
            });
    }

    getFoodItem(fdcId: number, onFetched: (foodItem?: FoodItem) => void) {
        const options = {
            method: 'GET',
            url: `${USDA_BASE_URL}/food/${fdcId}`,
            params: {
                format: 'full',
                nutrients: 203,
                api_key: USDA_FOOD_API_KEY,
            },
        };

        axios
            .request(options)
            .then(({ data }: { data: any }) => {
                const decode = (decoded: object) => BrandedFoodResponse.decode(decoded);
                const decodedData: Either<Errors, any> = decode(data);

                if (isLeft(decodedData)) {
                    // decode failed
                    // TODO: report error to crashlytics
                    onFetched(undefined);
                    return;
                }

                const foodData = decodedData.right;
                if (!isNil(foodData.fdcId)
                    && !isNil(foodData.brandName)
                    && !isNil(foodData.brandOwner)
                    && !isNil(foodData.description)) {
                    let servingSize = '';
                    if (!isNil(foodData.householdServingFullText) && foodData.householdServingFullText !== '') {
                        servingSize = `(${capitalizeFirstLetterOfEveryWord(foodData.householdServingFullText)})`;
                    } else if (!isNil(foodData.servingSize) && !isNil(foodData.servingSizeUnit)) {
                        servingSize = `(${foodData.servingSize} ${foodData.servingSizeUnit})`;
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
                            fat: foodData.labelNutrients.fat.value ?? 0,
                        },
                    });
                } else {
                    // TODO: report error to crashlytics
                    onFetched(undefined);
                }
            })
            .catch((error: any) => {
                console.error(error);
                // TODO: report error to crashlytics
                onFetched(undefined);
            });
    }
}

const foodSearchService = new FoodSearchService() as IFoodSearchService;
export default foodSearchService;
