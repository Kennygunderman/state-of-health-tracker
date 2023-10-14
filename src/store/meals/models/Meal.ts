import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import FoodItem from '../../food/models/FoodItem';
import Unique from '../../models/Unique';

export interface Meal extends Unique {
    createdDate: number;
    name: string;
    food: FoodItem[]
}

export function createMeal(name: string, food: FoodItem[]): Meal {
    return {
        name,
        food,
        createdDate: Date.now(),
        id: uuidv4(),
    };
}
