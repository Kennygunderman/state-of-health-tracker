import firestore from '@react-native-firebase/firestore';
import { collection, doc } from '@react-native-firebase/firestore/lib/modular';
import { getDocs, query } from '@react-native-firebase/firestore/lib/modular/query';
import { DAILY_MEAL_ENTRIES_INITIAL_STATE } from '../../store/dailyMealEntries/DailyMealEntriesReducer';
import { DailyMealEntryMap } from '../../store/dailyMealEntries/DailyMealEntriesState';
import { createDailyMealEntry, DailyMealEntry } from '../../store/dailyMealEntries/models/DailyMealEntry';
import { FOOD_INITIAL_STATE } from '../../store/food/FoodReducer';
import LocalStore from '../../store/LocalStore';
import { MEALS_INITIAL_STATE } from '../../store/meals/MealsReducer';
import { MealMap } from '../../store/meals/MealsState';
import { Meal } from '../../store/meals/models/Meal';
import { USER_INITIAL_STATE } from '../../store/user/initialState';
import User from '../../data/models/User';
import { USER_INFO_INITIAL_STATE } from '../../store/userInfo/UserInfoReducer';
import { getCurrentDate } from '../../utility/DateUtility';
import { useSessionStore } from "../../store/session/useSessionStore";

interface RemoteDailyMealEntry {
    id: string;
    date: string;
    userId: string;
    meals: Meal[];
}

// This is horrible, what was i thinking
class UserService {
    async saveUserData(account: User, store: LocalStore) {
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

            await this.saveDailyMealEntries(account, store.dailyMealEntries.map, store.meals.map);

        } catch (error: any) {
            console.log('sync err', error);
        }
    }

    async saveDailyMealEntries(account: User, dailyMealEntryMap: DailyMealEntryMap, mealMap: MealMap) {
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

    handleLegacyMigration(legacyUserData: any): LocalStore {
        const mealEntryMap = legacyUserData.dailyMealEntries.map;
        const newMealEntryMap: { [date: string]: DailyMealEntry } = {};
        Object.keys(mealEntryMap).forEach((dateKey) => {
            newMealEntryMap[dateKey] = createDailyMealEntry(mealEntryMap[dateKey]);
        });

        return {
            user: legacyUserData?.user ?? USER_INITIAL_STATE,
            userInfo: legacyUserData ? { ...legacyUserData.userInfo, currentDate: useSessionStore.getState().sessionStartDate } : USER_INFO_INITIAL_STATE,
            food: legacyUserData?.food ?? FOOD_INITIAL_STATE,
            meals: legacyUserData?.meals ?? MEALS_INITIAL_STATE,
            dailyMealEntries: newMealEntryMap ? { map: newMealEntryMap } : DAILY_MEAL_ENTRIES_INITIAL_STATE,
        };
    }

    async fetchUserData(userId: string): Promise<LocalStore> {
        try {
            const user = await this.fetchUserDoc('user', userId);

            const isLegacyUser = user && 'user' in user && 'userInfo' in user;
            if (isLegacyUser) {
                return this.handleLegacyMigration(user);
            }

            const userInfo = await this.fetchUserDoc('userInfo', userId);
            const { mealMap, dailyMealEntryMap } = await this.fetchMealEntries(userId);

            const store: LocalStore = {
                //@ts-ignore
                user: user ?? USER_INITIAL_STATE,
                // @ts-ignore
                userInfo: userInfo ? { ...userInfo, currentDate: getCurrentDate() } : USER_INFO_INITIAL_STATE,
                // @ts-ignore
                food: await this.fetchUserDoc('userFood', userId) ?? FOOD_INITIAL_STATE,
                meals: { map: mealMap },
                dailyMealEntries: { map: dailyMealEntryMap },
            };

            return store;
        } catch (error: any) {
            // Re-throw so the caller can handle it with try/catch
            throw error;
        }
    }
}

const userService = new UserService();
export default userService;
