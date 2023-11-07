import { DailyExerciseEntry } from './models/DailyExerciseEntry';

export default interface DailyExerciseEntriesState {
    map: DailyExerciseMap;
}

export interface DailyExerciseMap {
    [date: string]: DailyExerciseEntry;
}
