import { v4 as uuidv4 } from 'uuid';
import Unique from '../../models/Unique';

export interface ExerciseSet extends Unique {
    reps?: number;
    weight?: number;
    completed: boolean;
}

export function createSet(): ExerciseSet {
    return {
        id: uuidv4(),
        completed: false,
    };
}
