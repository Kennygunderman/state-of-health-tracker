import AsyncStorage from '@react-native-async-storage/async-storage';
import { composeWithDevTools } from '@redux-devtools/extension';
import { useDispatch } from 'react-redux';
import { applyMiddleware, combineReducers, legacy_createStore as createStore } from 'redux';
import { createMigrate, persistReducer, persistStore } from 'redux-persist';
import thunk, { ThunkDispatch } from 'redux-thunk';
import { dailyExerciseEntriesReducer } from './dailyExerciseEntries/DailyExerciseEntriesReducer';
import { addDailyMealEntry } from './dailyMealEntries/DailyMealEntriesActions';
import { dailyMealEntriesReducer } from './dailyMealEntries/DailyMealEntriesReducer';
import { exercisesReducer } from './exercises/ExercisesReducer';
import { foodReducer } from './food/FoodReducer';
import initialState from './initialState';
import LocalStore from './LocalStore';
import { mealsReducer } from './meals/MealsReducer';
import 'react-native-get-random-values';
import { migrations } from './migrations';
import { LOG_IN_USER, LOG_OUT_USER } from './user/UserActions';
import { userReducer } from './user/UserReducer';
import { setCurrentDate } from './userInfo/UserInfoActions';
import { userInfoReducer } from './userInfo/UserInfoReducer';
import { getCurrentDate } from '../utility/DateUtility';

const appReducer = combineReducers({
    user: userReducer,
    userInfo: userInfoReducer,
    meals: mealsReducer,
    food: foodReducer,
    dailyMealEntries: dailyMealEntriesReducer,
    exercises: exercisesReducer,
    dailyExerciseEntries: dailyExerciseEntriesReducer,
});

const rootReducer = (state: any, action: Action<any>) => {
    if (action.type === LOG_IN_USER) {
        if (action.payload) {
            return appReducer(action.payload, action);
        }
    }

    if (action.type === LOG_OUT_USER) {
        return appReducer(initialState, action);
    }

    return appReducer(state, action);
};

const persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    version: 3,
    whitelist: [
        'user',
        'userInfo',
        'meals',
        'food',
        'dailyMealEntries',
        'exercises',
        'dailyExerciseEntries',
    ],
    migrate: createMigrate(migrations, { debug: false }),
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = createStore(
    persistedReducer,
    initialState,
    composeWithDevTools(
        applyMiddleware(thunk),
    ),
);

persistStore(store, null, () => {
    const currentDate = getCurrentDate();
    store.dispatch(setCurrentDate(currentDate));
    store.dispatch(addDailyMealEntry(currentDate));
});

type AppAction = ReturnType<typeof store.dispatch>;
export type IThunkDispatch = ThunkDispatch<LocalStore, any, AppAction>;
export const useThunkDispatch = () => useDispatch<IThunkDispatch>();

export default store;
