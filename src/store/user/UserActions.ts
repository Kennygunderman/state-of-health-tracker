import userService from '../../service/user/UserService';
import { isDateOlderThanADay } from '../../utility/DateUtility';
import { setMealEntriesSynced } from '../dailyMealEntries/DailyMealEntriesActions';
import LocalStore from '../LocalStore';

export const UPDATE_LAST_SYNCED: string = 'UPDATE_LAST_SYNCED';

export function updateLastSynced(date: number) {
    return {
        payload: date,
        type: UPDATE_LAST_SYNCED,
    };
}

export function syncUserData(userId: string) {
    return async (dispatch: any, getState: () => LocalStore) => {
        // only sync logged-in users if last data sync was > 1 day ago.
        const { user } = getState();
        if (!isDateOlderThanADay(user.lastDataSync ?? 0)) {
            return;
        }

        await userService.saveUserData(userId, getState()).then(() => {
            dispatch(setMealEntriesSynced());
            dispatch(updateLastSynced(Date.now()));
        });
    };
}
