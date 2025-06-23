import { createDailyMealEntry, DailyMealEntry } from './dailyMealEntries/models/DailyMealEntry';
import CrashUtility from '../utility/CrashUtility';

type Migration = (state: any) => any;
function containAndLogMigrationError(migrationFn: Migration): Migration {
    return (state: any) => {
        try {
            return migrationFn(state);
        } catch (error) {
            CrashUtility.recordError(Error(`${error}`));
            return state;
        }
    };
}

const storageMigrationVersion2 = containAndLogMigrationError((state: any) => ({
    ...state,
    exercises: {
        map: state.exercises.map,
        templates: [],
    },
}));

const storageMigrationVersion3 = containAndLogMigrationError((state: any) => {
    const mealEntryMap = state.dailyMealEntries.map;
    const newMealEntryMap: { [date: string]: DailyMealEntry } = {};
    Object.keys(mealEntryMap).forEach((dateKey) => {
        newMealEntryMap[dateKey] = createDailyMealEntry(mealEntryMap[dateKey]);
    });

    return ({
        ...state,
        dailyMealEntries: {
            map: newMealEntryMap,
        },
    });
});

export const migrations: any = {
    2: storageMigrationVersion2,
    3: storageMigrationVersion3,
};
