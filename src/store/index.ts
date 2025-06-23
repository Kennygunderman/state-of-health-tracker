import AsyncStorage from '@react-native-async-storage/async-storage';
import { composeWithDevTools } from '@redux-devtools/extension';
import { useDispatch } from 'react-redux';
import { applyMiddleware, combineReducers, legacy_createStore as createStore } from 'redux';
import { createMigrate, persistReducer, persistStore } from 'redux-persist';
import thunk, { ThunkDispatch } from 'redux-thunk';
import { addDailyMealEntry } from './dailyMealEntries/DailyMealEntriesActions';
import { dailyMealEntriesReducer } from './dailyMealEntries/DailyMealEntriesReducer';
import { foodReducer } from './food/FoodReducer';
import initialState from './initialState';
import LocalStore from './LocalStore';
import { mealsReducer } from './meals/MealsReducer';
import 'react-native-get-random-values';
import { migrations } from './migrations';
import { userReducer } from './user/UserReducer';
import { getCurrentDate } from '../utility/DateUtility';

const appReducer = combineReducers({
    user: userReducer,
    meals: mealsReducer,
    food: foodReducer,
    dailyMealEntries: dailyMealEntriesReducer,
});

const rootReducer = (state: any, action: Action<any>) => {
    return appReducer(state, action);
};

const persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    version: 3,
    whitelist: [
        'user',
        'meals',
        'food',
        'dailyMealEntries',
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
    store.dispatch(addDailyMealEntry(getCurrentDate()));
});

type AppAction = ReturnType<typeof store.dispatch>;
export type IThunkDispatch = ThunkDispatch<LocalStore, any, AppAction>;
export const useThunkDispatch = () => useDispatch<IThunkDispatch>();

export default store;
