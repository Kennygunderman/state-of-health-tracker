import { v4 as uuidv4 } from 'uuid';
import Unique from '../../models/Unique';

export interface WorkoutTemplate extends Unique {
    name: string;
    tagline: string;
    exerciseIds: string[];
}

export const createWorkoutTemplate = (name: string, tagline: string, exerciseIds: string[]): WorkoutTemplate => ({
    id: uuidv4(),
    name,
    tagline,
    exerciseIds,
});
