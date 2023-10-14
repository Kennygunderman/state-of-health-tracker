import DailyExerciseEntriesState from './dailyExerciseEntries/DailyExerciseEntriesState';
import DailyMealEntriesState from './dailyMealEntries/DailyMealEntriesState';
import ExercisesState from './exercises/ExercisesState';
import FoodState from './food/FoodState';
import MealsState from './meals/MealsState';
import { UserState } from './user/UserState';

export default interface LocalStore {
    meals: MealsState;
    food: FoodState;
    dailyMealEntries: DailyMealEntriesState;
    exercises: ExercisesState;
    dailyExerciseEntries: DailyExerciseEntriesState;
    userInfo: UserInfoState;
    user: UserState;
}
