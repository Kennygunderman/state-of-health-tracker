import { createSelector, ParametricSelector } from 'reselect';
import FoodItem from '../store/food/models/FoodItem';
import LocalStore from '../store/LocalStore';

function getFood(batch: number, filter: string, foods: FoodItem[]): FoodItem[] {
    const items = [...foods].reverse();
    const filtered = filter === ''
        ? items
        : foods.filter((foodItem) =>
            foodItem.name.toLowerCase().includes(filter.toLocaleLowerCase())
        );

    const uniqueItems: FoodItem[] = [];
    const seenIds = new Set();

    filtered.forEach((item) => {
        if (!seenIds.has(item.id)) {
            uniqueItems.push(item);
            seenIds.add(item.id);
        }
    });

    return uniqueItems.slice(0, batch);
}
export const getFoodSelector: ParametricSelector<LocalStore, number | string | any, FoodItem[]> = createSelector(
    (_: LocalStore, batch: number) => batch,
    (_: LocalStore, __: number, filter: string) => filter,
    (state: LocalStore, __: number, _: string) => state.food.foods,
    getFood,
);
