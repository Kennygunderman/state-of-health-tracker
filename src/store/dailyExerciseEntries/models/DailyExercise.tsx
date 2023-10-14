import { v4 as uuidv4 } from 'uuid';
import { Exercise } from '../../exercises/models/Exercise';
import { ExerciseSet } from '../../exercises/models/ExerciseSet';
import Unique from '../../models/Unique';

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
