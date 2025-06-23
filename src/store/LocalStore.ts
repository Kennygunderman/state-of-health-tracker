import DailyMealEntriesState from './dailyMealEntries/DailyMealEntriesState'
import FoodState from './food/FoodState'
import MealsState from './meals/MealsState'
import {UserState} from './user/UserState'

export default interface LocalStore {
  meals: MealsState
  food: FoodState
  dailyMealEntries: DailyMealEntriesState
  user: UserState
}
