import { v4 as uuidv4 } from 'uuid';
import { Exercise } from './Exercise';
import { ExerciseSet } from './ExerciseSet';
import Unique from '../../store/models/Unique';

export interface DailyExercise extends Unique {
    exercise: Exercise;
    sets: ExerciseSet[];
}

export function createDailyExercise(exercise: Exercise, sets: ExerciseSet[] = []): DailyExercise {
    return {
        id: uuidv4(),
        exercise,
        sets,
    };
}
