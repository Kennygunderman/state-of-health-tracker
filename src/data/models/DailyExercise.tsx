import { v4 as uuidv4 } from 'uuid';
import { Exercise } from './Exercise';
import { ExerciseSet } from './ExerciseSet';
import Unique from '../../store/models/Unique';

export interface DailyExercise extends Unique {
    exercise: Exercise;
    order?: number;
    sets: ExerciseSet[];
}

export function createDailyExercise(exercise: Exercise, order: number, sets: ExerciseSet[] = []): DailyExercise {
    return {
        id: uuidv4(),
        order,
        exercise,
        sets,
    };
}
