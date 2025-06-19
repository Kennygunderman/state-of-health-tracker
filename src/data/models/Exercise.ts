import { ExerciseSet } from './ExerciseSet';

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

export interface CreateExercisePayload {
    name: string;
    exerciseType: string;
    exerciseBodyPart: string;
}

export interface Exercise {
    id: string;
    name: string;
    exerciseType: ExerciseTypeEnum;
    exerciseBodyPart: ExerciseBodyPartEnum;
    latestCompletedSets: ExerciseSet[];
}

export function isExerciseObject(object: any): object is Exercise {
    return 'id' in object && 'name' in object && 'exerciseType' in object && 'exerciseBodyPart' in object && 'latestCompletedSets' in object;
}
