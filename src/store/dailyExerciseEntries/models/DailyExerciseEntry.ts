import { v4 as uuidv4 } from 'uuid';
import { DailyExercise } from '../../../data/models/DailyExercise';
import Unique from '../../models/Unique';

export interface DailyExerciseEntry extends Unique {
    userId?: string;
    hasSynced: boolean; // value to determine if meal entry needs to be synced to BE.
    dailyExercises: DailyExercise[];
}

export function createDailyExerciseEntry(dailyExercises: DailyExercise[] = []) {
    return {
        id: uuidv4(),
        hasSynced: false,
        dailyExercises,
    };
}
