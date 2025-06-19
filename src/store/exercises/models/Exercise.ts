import { v4 as uuidv4 } from 'uuid';
import { ExerciseSet } from './ExerciseSet';
import Unique from '../../models/Unique';

export enum ExerciseTypeEnum {
    BARBELL = 'Barbell',
    DUMBBELL = 'Dumbbell',
    BODYWEIGHT = 'Bodyweight',
    CABLE = 'Cable',
    MACHINE = 'Machine',
    WEIGHTED = 'Weighted',
    KETTLEBELL = 'Kettlebell',
    TIMED = 'Timed',
    OTHER = 'Other',
}

export enum ExerciseBodyPartEnum {
    CHEST = 'Chest',
    BACK = 'Back',
    SHOULDERS = 'Shoulders',
    TRAPS = 'Traps',
    TRICEPS = 'Triceps',
    BICEPS = 'Biceps',
    CORE = 'Core',
    LEGS = 'Legs',
    CALVES = 'Calves',
    FULL_BODY = 'Full Body',
    CARDIO = 'Cardio',
    OTHER = 'Other',
}

export interface Exercise extends Unique {
    name: string;
    exerciseType: ExerciseTypeEnum;
    exerciseBodyPart: ExerciseBodyPartEnum;
    latestCompletedSets: ExerciseSet[] | undefined[];
    source?: 'remote' | 'local';
}

export function createExerciseName(exerciseName: string, exerciseType: ExerciseTypeEnum): string {
    let name: string = exerciseName;
    if (exerciseType !== ExerciseTypeEnum.OTHER) {
        name += ` (${exerciseType})`;
    }

    return name;
}

export function createExercise(
    name: string,
    exerciseType: ExerciseTypeEnum = ExerciseTypeEnum.OTHER,
    exerciseBodyPart: ExerciseBodyPartEnum = ExerciseBodyPartEnum.OTHER,
    latestCompletedSets = [],
): Exercise {
    return {
        id: uuidv4(),
        name,
        exerciseType,
        exerciseBodyPart,
        latestCompletedSets,
    };
}

export function isExerciseObject(object: any): object is Exercise {
    return 'id' in object && 'name' in object && 'exerciseType' in object && 'exerciseBodyPart' in object && 'latestCompletedSets' in object;
}
