import firestore from '@react-native-firebase/firestore';
import { DAILY_EXERCISE_ENTRIES_INITIAL_STATE } from '../../store/dailyExerciseEntries/DailyExerciseEntriesReducer';
import { DAILY_MEAL_ENTRIES_INITIAL_STATE } from '../../store/dailyMealEntries/DailyMealEntriesReducer';
import { EXERCISES_INITIAL_STATE } from '../../store/exercises/ExercisesReducer';
import { FOOD_INITIAL_STATE } from '../../store/food/FoodReducer';
import LocalStore from '../../store/LocalStore';
import { MEALS_INITIAL_STATE } from '../../store/meals/MealsReducer';
import { USER_INITIAL_STATE } from '../../store/user/initialState';
import Account from '../../store/user/models/Account';
import { USER_INFO_INITIAL_STATE } from '../../store/userInfo/UserInfoReducer';

// Sync's the users Local store with server.
interface IUserSyncService {
    syncUserData: (account: Account, store: LocalStore, onDataSynced: () => void, onError: (errorCode: string) => void) => void;
    fetchUserData: (userId: string, onDataFetched: (data: LocalStore) => void, onError: (errorCode: string) => void) => void;
}

class UserSyncService implements IUserSyncService {
    readonly userPath = 'user';

    async syncUserData(account: Account, store: LocalStore, onDataSynced: () => void, onError: (error: string) => void) {
        try {
            await firestore().collection(this.userPath).doc(account.id).set(
                {
                    user: {
                        account,
                    },
                    userInfo: store.userInfo,
                    food: store.food,
                    exercises: store.exercises,
                    meals: store.meals,
                    dailyMealEntries: store.dailyMealEntries,
                    dailyExerciseEntries: store.dailyExerciseEntries,
                },
            );
            onDataSynced();
        } catch (error: any) {
            onError(error);
        }
    }

    async fetchUserData(userId: string, onDataFetched: (data: LocalStore) => void, onError: (error: string) => void) {
        try {
            const docSnap = await firestore().collection(this.userPath).doc(userId).get();
            const data = docSnap.data();
            const store: LocalStore = {
                user: data?.user ?? USER_INITIAL_STATE,
                userInfo: data?.userInfo ?? USER_INFO_INITIAL_STATE,
                food: data?.food ?? FOOD_INITIAL_STATE,
                meals: data?.meals ?? MEALS_INITIAL_STATE,
                exercises: data?.exercises ?? EXERCISES_INITIAL_STATE,
                dailyMealEntries: data?.dailyMealEntries ?? DAILY_MEAL_ENTRIES_INITIAL_STATE,
                dailyExerciseEntries: data?.dailyExerciseEntries ?? DAILY_EXERCISE_ENTRIES_INITIAL_STATE,
            };
            onDataFetched(store);
        } catch (error: any) {
            onError(error);
        }
    }
}

const userSyncService = new UserSyncService() as IUserSyncService;
export default userSyncService;
