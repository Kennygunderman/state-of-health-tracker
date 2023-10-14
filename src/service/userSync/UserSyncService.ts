import { FirebaseApp } from '@firebase/app';
import {
    getFirestore, doc, setDoc, getDoc,
} from 'firebase/firestore';
import { DAILY_EXERCISE_ENTRIES_INITIAL_STATE } from '../../store/dailyExerciseEntries/DailyExerciseEntriesReducer';
import { DAILY_MEAL_ENTRIES_INITIAL_STATE } from '../../store/dailyMealEntries/DailyMealEntriesReducer';
import { EXERCISES_INITIAL_STATE } from '../../store/exercises/ExercisesReducer';
import { FOOD_INITIAL_STATE } from '../../store/food/FoodReducer';
import LocalStore from '../../store/LocalStore';
import { MEALS_INITIAL_STATE } from '../../store/meals/MealsReducer';
import { USER_INITIAL_STATE } from '../../store/user/initialState';
import Account from '../../store/user/models/Account';
import { USER_INFO_INITIAL_STATE } from '../../store/userInfo/UserInfoReducer';
import app from '../index';

// Sync's the users Local store with server.
interface IUserSyncService {
    syncUserData: (account: Account, store: LocalStore, onDataSynced: () => void, onError: (errorCode: string) => void) => void;
    fetchUserData: (userId: string, onDataFetched: (data: LocalStore) => void, onError: (errorCode: string) => void) => void;
}

class UserSyncService implements IUserSyncService {
    readonly db;

    readonly userPath = 'user';

    constructor(firebaseApp: FirebaseApp) {
        this.db = getFirestore(firebaseApp);
    }

    private storeConverter = {
        toFirestore: (store: LocalStore) => ({
            user: store.user,
            userInfo: store.userInfo,
            food: store.food,
            exercises: store.exercises,
            meals: store.meals,
            dailyMealEntries: store.dailyMealEntries,
            dailyExerciseEntries: store.dailyExerciseEntries,
        }),
        fromFirestore: (snapshot: any, options: any) => {
            const data = snapshot.data(options);
            return {
                user: data.user,
                userInfo: data.userInfo,
                food: data.food,
                exercises: data.exercises,
                meals: data.meals,
                dailyMealEntries: data.dailyMealEntries,
                dailyExerciseEntries: data.dailyExerciseEntries,
            };
        },
    };

    async syncUserData(account: Account, store: LocalStore, onDataSynced: () => void, onError: (error: string) => void) {
        try {
            await setDoc(doc(this.db, this.userPath, account.id).withConverter(this.storeConverter), {
                user: {
                    account,
                },
                userInfo: store.userInfo,
                food: store.food,
                exercises: store.exercises,
                meals: store.meals,
                dailyMealEntries: store.dailyMealEntries,
                dailyExerciseEntries: store.dailyExerciseEntries,
            });
            onDataSynced();
        } catch (error: any) {
            onError(error);
        }
    }

    async fetchUserData(userId: string, onDataFetched: (data: LocalStore) => void, onError: (error: string) => void) {
        const docRef = doc(this.db, this.userPath, userId).withConverter(this.storeConverter);

        try {
            const docSnap = await getDoc(docRef);
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

const userSyncService = new UserSyncService(app) as IUserSyncService;
export default userSyncService;
