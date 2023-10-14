import { Meal } from './models/Meal';

export default interface MealsState {
    map: MealMap;
}

export interface MealMap {
    [id: string]: Meal;
}
