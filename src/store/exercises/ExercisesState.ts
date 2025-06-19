import { Exercise } from '../../data/models/Exercise';
import { WorkoutTemplate } from './models/WorkoutTemplate';

export default interface ExercisesState {
    templates: WorkoutTemplate[];
    map: ExerciseMap;
}

export interface ExerciseMap {
    [name: string]: Exercise;
}
