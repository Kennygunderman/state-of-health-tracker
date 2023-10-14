import { Exercise } from './models/Exercise';

export default interface ExercisesState {
    map: ExerciseMap;
}

export interface ExerciseMap {
    [name: string]: Exercise;
}
