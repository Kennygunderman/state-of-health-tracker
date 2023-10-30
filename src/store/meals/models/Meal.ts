import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import FoodItem, { Macros } from '../../food/models/FoodItem';
import Unique from '../../models/Unique';

export interface Meal extends Unique {
    createdDate: number;
    name: string;
    food: FoodItem[]
}

export function getCaloriesForMeal(meal: Meal) {
    let calories = 0;
    meal.food.forEach((foodItem) => {
        calories += foodItem.calories * foodItem.servings;
    });

    return calories;
}

export function getMacrosForMeal(meal: Meal): Macros {
    const macros: Macros = {
        protein: 0,
        carbs: 0,
        fat: 0,
    };
    meal.food.forEach((foodItem) => {
        macros.protein += foodItem.macros.protein;
        macros.carbs += foodItem.macros.carbs;
        macros.fat += foodItem.macros.fat;
    });

    return macros;
}

export function createMeal(name: string, food: FoodItem[]): Meal {
    return {
        name,
        food,
        createdDate: Date.now(),
        id: uuidv4(),
    };
}
