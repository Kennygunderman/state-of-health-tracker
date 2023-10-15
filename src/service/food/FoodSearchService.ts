import axios from 'axios';
import { Either, isLeft } from 'fp-ts/lib/Either';
import * as io from 'io-ts';
import { Errors } from 'io-ts';
import { isNil } from 'lodash';
import { FDA_FOOD_API_KEY } from '../../../config';

export interface SearchFoodItem {
    fdcId: number;
    brandName: string;
    brandOwner: string;
    description: string;
}

interface IFoodSearchService {
    searchBrandedFoods: (searchQuery: string, onFetched: (foods: SearchFoodItem[]) => void) => void;
}

const SearchFoodItemResponse = io.partial({
    fdcId: io.union([io.number, io.null]),
    brandName: io.union([io.string, io.null]),
    brandOwner: io.union([io.string, io.null]),
    description: io.union([io.string, io.null]),
});

const SearchFoodResponse = io.partial({
    foods: io.array(SearchFoodItemResponse),
});

class FoodSearchService implements IFoodSearchService {
    searchBrandedFoods(searchQuery: string, onFetched: (foods: SearchFoodItem[]) => void): void {
        const options = {
            method: 'GET',
            url: 'https://api.nal.usda.gov/fdc/v1/foods/search',
            params: {
                query: searchQuery,
                dataType: 'Branded',
                pageSize: 30,
                pageNumber: 1,
                sortBy: 'dataType.keyword',
                sortOrder: 'asc',
                api_key: FDA_FOOD_API_KEY,
            },
        };
        axios
            .request(options)
            .then(({ data }: { data: any }) => {
                const decode = (decoded: object) => SearchFoodResponse.decode(decoded);
                const decodedData: Either<Errors, any> = decode(data);
                if (isLeft(decodedData)) {
                    // decode failed
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
                            description: foodResponse.description,
                        });
                    }
                });

                onFetched(foodItems);
            })
            .catch((error: any) => {
                onFetched([]);
                console.error(error);
            });
    }
}

const foodSearchService = new FoodSearchService() as IFoodSearchService;
export default foodSearchService;
