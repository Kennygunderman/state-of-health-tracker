import { createDailyMealEntry } from './dailyMealEntries/models/DailyMealEntry';
// import { createExercise, ExerciseBodyPartEnum, ExerciseTypeEnum } from '../data/models/Exercise';
import { createFood } from './food/models/FoodItem';
import LocalStore from './LocalStore';
import { createMeal } from './meals/models/Meal';
import AuthStatus from './user/models/AuthStatus';
import { BREAKFAST_MEAL_NAME, DINNER_MEAL_NAME, LUNCH_MEAL_NAME } from '../constants/Strings';
import { getCurrentDate } from '../utility/DateUtility';

const initialDate = getCurrentDate();
const initialMealBreakfast = createMeal(BREAKFAST_MEAL_NAME, []);
const initialMealLunch = createMeal(LUNCH_MEAL_NAME, []);
const initialMealDinner = createMeal(DINNER_MEAL_NAME, []);
const localStore: LocalStore = {
    user: { lastDataSync: 0, authStatus: AuthStatus.LOGGED_OUT },
    userInfo: {
        currentDate: initialDate, targetCalories: 2000, targetWorkouts: 5, dateWeightMap: {},
    },
    food: {
        foods: [
            createFood('Chicken Breast (4oz)', 1, '176', { protein: 35, carbs: 0, fat: 4 }),
            createFood('Egg (Large)', 1, '78', { protein: 6, carbs: 0, fat: 6 }),
            createFood('Peanut Butter (2 tbsp)', 1, '180', { protein: 7, carbs: 4, fat: 16 }),
            createFood('Apple (Medium)', 1, '96', { protein: 0, carbs: 24, fat: 0 }),
        ],
    },
    meals: {
        map: {
            [initialMealBreakfast.id]: initialMealBreakfast,
            [initialMealLunch.id]: initialMealLunch,
            [initialMealDinner.id]: initialMealDinner,
        },
    },
    dailyMealEntries: {
        map: {
            [initialDate]: createDailyMealEntry([initialMealBreakfast.id, initialMealLunch.id, initialMealDinner.id]),
        },
    },
    exercises: {
        templates: [],
        map: {
            // 'Bench Press (Barbell)': createExercise('Bench Press (Barbell)', ExerciseTypeEnum.BARBELL, ExerciseBodyPartEnum.CHEST),
            // 'Bent Over One Arm Row (Dumbbell)': createExercise('Bent Over One Arm Row (Dumbbell)', ExerciseTypeEnum.DUMBBELL, ExerciseBodyPartEnum.BACK),
            // 'Close Grip Bench Press (Barbell)': createExercise('Close Grip Bench Press (Barbell)', ExerciseTypeEnum.BARBELL, ExerciseBodyPartEnum.TRICEPS),
            // 'Pull Up (Body weight)': createExercise('Pull Up (Bodyweight)', ExerciseTypeEnum.BODYWEIGHT, ExerciseBodyPartEnum.BACK),
            // 'Bench Press (Dumbbell)': createExercise('Bench Press (Dumbbell)', ExerciseTypeEnum.DUMBBELL, ExerciseBodyPartEnum.CHEST),
            // 'Overhead Press (Barbell)': createExercise('Overhead Press (Barbell)', ExerciseTypeEnum.BARBELL, ExerciseBodyPartEnum.SHOULDERS),
        },
    },
    dailyExerciseEntries: { map: {} },
};

export default localStore;
