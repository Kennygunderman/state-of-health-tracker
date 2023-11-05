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

export const migrations: any = {
    2: storageMigrationVersion2,
};
