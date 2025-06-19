import { v4 as uuidv4 } from 'uuid';
import Unique from '../../store/models/Unique';

export interface ExerciseSet extends Unique {
    reps?: number;
    weight?: number;
    setNumber?: number | null;
    completedAt?: string | null;
    completed: boolean;
}

export function createSet(): ExerciseSet {
    return {
        id: uuidv4(),
        completed: false,
    };
}
