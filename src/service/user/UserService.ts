import firestore from '@react-native-firebase/firestore';
import { collection, doc } from '@react-native-firebase/firestore/lib/modular';
import { getDocs, query } from '@react-native-firebase/firestore/lib/modular/query';
import { DAILY_EXERCISE_ENTRIES_INITIAL_STATE } from '../../store/dailyExerciseEntries/DailyExerciseEntriesReducer';
import { DailyExerciseMap } from '../../store/dailyExerciseEntries/DailyExerciseEntriesState';
import { DailyExercise } from '../../store/dailyExerciseEntries/models/DailyExercise';
import {
    createDailyExerciseEntry,
    DailyExerciseEntry,
} from '../../store/dailyExerciseEntries/models/DailyExerciseEntry';
import { DAILY_MEAL_ENTRIES_INITIAL_STATE } from '../../store/dailyMealEntries/DailyMealEntriesReducer';
import { DailyMealEntryMap } from '../../store/dailyMealEntries/DailyMealEntriesState';
import { createDailyMealEntry, DailyMealEntry } from '../../store/dailyMealEntries/models/DailyMealEntry';
import { EXERCISES_INITIAL_STATE } from '../../store/exercises/ExercisesReducer';
import { FOOD_INITIAL_STATE } from '../../store/food/FoodReducer';
import LocalStore from '../../store/LocalStore';
import { MEALS_INITIAL_STATE } from '../../store/meals/MealsReducer';
import { MealMap } from '../../store/meals/MealsState';
import { Meal } from '../../store/meals/models/Meal';
import { USER_INITIAL_STATE } from '../../store/user/initialState';
import Account from '../../store/user/models/Account';
import { USER_INFO_INITIAL_STATE } from '../../store/userInfo/UserInfoReducer';
import { getCurrentDate } from '../../utility/DateUtility';

interface IUserService {
    saveUserData: (account: Account, store: LocalStore, onDataSynced: () => void, onError: (errorCode: string) => void) => void;
    fetchUserData: (userId: string, onDataFetched: (data: LocalStore) => void, onError: (errorCode: string) => void) => void;
}

interface RemoteDailyMealEntry {
    id: string;
    date: string;
    userId: string;
    meals: Meal[];
}

interface RemoteDailyExerciseEntry {
    id: string;
    date: string;
    userId?: string;
    dailyExercises: DailyExercise[];
}

class UserService implements IUserService {
    async saveUserData(account: Account, store: LocalStore, onDataSynced: () => void, onError: (error: string) => void) {
        try {
            await firestore().collection('user').doc(account.id).set(
                {
                    account: {
                        ...store.user.account,
                    },
                    lastDataSync: store?.user?.lastDataSync ?? 0,
                },
            );

            await firestore().collection('userInfo').doc(account.id).set(
                {
                    targetCalories: store.userInfo.targetCalories,
                    targetWorkouts: store.userInfo.targetWorkouts,
                    dateWeightMap: store.userInfo.dateWeightMap,
                },
            );

            await firestore().collection('userFood').doc(account.id).set(
                {
                    ...store.food,
                },
            );

            await firestore().collection('userExercises').doc(account.id).set(
                {
                    ...store.exercises,
                },
            );

            await this.saveDailyMealEntries(account, store.dailyMealEntries.map, store.meals.map);

            await this.saveDailyExerciseEntries(account, store.dailyExerciseEntries.map);

            onDataSynced();
        } catch (error: any) {
            console.log('sync err', error);
            onError(error);
        }
    }

    async saveDailyMealEntries(account: Account, dailyMealEntryMap: DailyMealEntryMap, mealMap: MealMap) {
        const dailyEntries: RemoteDailyMealEntry[] = [];
        Object.keys(dailyMealEntryMap).forEach((key) => {
            const dailyEntry = dailyMealEntryMap[key];
            if (dailyEntry?.hasSynced !== true && dailyEntry?.id) {
                const entry: RemoteDailyMealEntry = {
                    id: dailyEntry.id,
                    date: key,
                    userId: account.id,
                    meals: [],
                };
                const mealIds = dailyEntry?.mealIds;
                if (mealIds) {
                    mealIds.forEach((mealId) => {
                        const meal = mealMap[mealId];
                        if (meal) {
                            entry.meals.push(meal);
                        }
                    });
                }

                dailyEntries.push(entry);
            }
        });

        const batch = firestore().batch();

        dailyEntries.forEach((entry) => {
            const docRef = doc(firestore(), 'dailyMealEntries', entry.id);
            batch.set(docRef, entry);
        });

        await batch.commit();
    }

    async saveDailyExerciseEntries(account: Account, dailyExerciseMap: DailyExerciseMap) {
        const dailyEntries: RemoteDailyExerciseEntry[] = [];
        Object.keys(dailyExerciseMap).forEach((key) => {
            const dailyEntry = dailyExerciseMap[key];

            if (dailyEntry?.hasSynced !== true && dailyEntry?.id) {
                const entry: RemoteDailyExerciseEntry = {
                    date: key,
                    id: dailyEntry.id,
                    userId: account.id,
                    dailyExercises: dailyExerciseMap[key].dailyExercises,
                };
                dailyEntries.push(entry);
            }
        });

        const batch = firestore().batch();

        dailyEntries.forEach((entry) => {
            const docRef = doc(firestore(), 'dailyExerciseEntries', entry.id);
            batch.set(docRef, entry);
        });

        await batch.commit();
    }

    async fetchUserDoc(path: string, userId: string) {
        const snap = await firestore().collection(path).doc(userId).get();
        return snap.data();
    }

    async fetchMealEntries(userId: string): Promise<{ mealMap: MealMap, dailyMealEntryMap: DailyMealEntryMap }> {
        const mealEntriesQuery = query(collection(firestore(), 'dailyMealEntries')).where('userId', '==', userId);
        const mealEntriesQuerySnapshot = await getDocs(mealEntriesQuery);

        const dailyMealEntryMap: DailyMealEntryMap = {};
        const mealMap: MealMap = {};
        mealEntriesQuerySnapshot.docs.forEach((d) => {
            const data = d.data();
            const { date, id, meals } = data;
            if (id && date && meals) {
                const mealIds = meals.map((meal: Meal) => meal.id);
                dailyMealEntryMap[date] = {
                    id,
                    userId,
                    mealIds,
                    hasSynced: true,
                };
            }

            if (meals) {
                meals.forEach((meal: Meal) => {
                    mealMap[meal.id] = meal;
                });
            }
        });

        return { mealMap, dailyMealEntryMap };
    }

    async fetchExerciseEntries(userId: string): Promise<DailyExerciseMap> {
        const exerciseEntriesQuery = query(collection(firestore(), 'dailyExerciseEntries')).where('userId', '==', userId);
        const exerciseEntriesQuerySnapshot = await getDocs(exerciseEntriesQuery);

        const dailyExerciseMap: DailyExerciseMap = {};
        exerciseEntriesQuerySnapshot.docs.forEach((d) => {
            const data = d.data();
            const { date, id, dailyExercises } = data;
            if (id && date && dailyExercises) {
                dailyExerciseMap[date] = {
                    id,
                    userId,
                    dailyExercises,
                    hasSynced: true,
                };
            }
        });

        return dailyExerciseMap;
    }

    handleLegacyMigration(legacyUserData: any): LocalStore {
        const mealEntryMap = legacyUserData.dailyMealEntries.map;
        const newMealEntryMap: { [date: string]: DailyMealEntry } = {};
        Object.keys(mealEntryMap).forEach((dateKey) => {
            newMealEntryMap[dateKey] = createDailyMealEntry(mealEntryMap[dateKey]);
        });

        const exerciseEntryMap = legacyUserData.dailyExerciseEntries.map;
        const newExerciseEntryMap: { [date: string]: DailyExerciseEntry } = {};
        Object.keys(exerciseEntryMap).forEach((dateKey) => {
            newExerciseEntryMap[dateKey] = createDailyExerciseEntry(exerciseEntryMap[dateKey]);
        });

        return {
            user: legacyUserData?.user ?? USER_INITIAL_STATE,
            userInfo: legacyUserData ? { ...legacyUserData.userInfo, currentDate: getCurrentDate() } : USER_INFO_INITIAL_STATE,
            food: legacyUserData?.food ?? FOOD_INITIAL_STATE,
            meals: legacyUserData?.meals ?? MEALS_INITIAL_STATE,
            exercises: legacyUserData?.exercises ?? EXERCISES_INITIAL_STATE,
            dailyMealEntries: newMealEntryMap ? { map: newMealEntryMap } : DAILY_MEAL_ENTRIES_INITIAL_STATE,
            dailyExerciseEntries: newExerciseEntryMap ? { map: newExerciseEntryMap } : DAILY_EXERCISE_ENTRIES_INITIAL_STATE,
        };
    }

    async fetchUserData(userId: string, onDataFetched: (data: LocalStore) => void, onError: (error: string) => void) {
        try {
            const user = await this.fetchUserDoc('user', userId);
            const isLegacyUser = user && 'user' in user && 'userInfo';
            if (isLegacyUser) {
                const store = this.handleLegacyMigration(user);
                onDataFetched(store);
                return;
            }

            const userInfo = await this.fetchUserDoc('userInfo', userId);

            const { mealMap, dailyMealEntryMap } = await this.fetchMealEntries(userId);
            const dailyExerciseMap = await this.fetchExerciseEntries(userId);

            const store: LocalStore = {
                // @ts-ignore
                user: user ?? USER_INITIAL_STATE,
                // @ts-ignore
                userInfo: userInfo ? { ...userInfo, currentDate: getCurrentDate() } : USER_INFO_INITIAL_STATE,
                // @ts-ignore
                food: await this.fetchUserDoc('userFood', userId) ?? FOOD_INITIAL_STATE,
                // @ts-ignore
                exercises: await this.fetchUserDoc('userExercises', userId) ?? EXERCISES_INITIAL_STATE,
                meals: { map: mealMap },
                dailyMealEntries: { map: dailyMealEntryMap },
                dailyExerciseEntries: { map: dailyExerciseMap },
            };
            onDataFetched(store);
        } catch (error: any) {
            onError(error);
        }
    }
}

const userService = new UserService() as IUserService;
export default userService;
