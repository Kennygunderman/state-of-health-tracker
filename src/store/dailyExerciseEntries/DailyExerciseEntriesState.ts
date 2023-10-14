import { DailyExercise } from './models/DailyExercise';

export default interface DailyExerciseEntriesState {
    map: DailyExerciseMap;
}

export interface DailyExerciseMap {
    [date: string]: DailyExercise[];
}
