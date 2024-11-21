import { ExerciseBodyPartEnum, ExerciseTypeEnum } from "../models/Exercise";

export const mapExerciseType = (type: string): ExerciseTypeEnum => {
    switch (type.toLowerCase()) {
        case 'barbell': return ExerciseTypeEnum.BARBELL;
        case 'dumbbell': return ExerciseTypeEnum.DUMBBELL;
        case 'body weight': return ExerciseTypeEnum.BODY_WEIGHT;
        case 'machine': return ExerciseTypeEnum.MACHINE;
        case 'weighted': return ExerciseTypeEnum.WEIGHTED;
        case 'kettlebell': return ExerciseTypeEnum.KETTLEBELL;
        case 'timed': return ExerciseTypeEnum.TIMED;
        default: return ExerciseTypeEnum.OTHER;
    }
};

export const mapExerciseBodyPart = (muscleGroup: string): ExerciseBodyPartEnum => {
    switch (muscleGroup.toLowerCase()) {
        case 'chest': return ExerciseBodyPartEnum.CHEST;
        case 'back': return ExerciseBodyPartEnum.BACK;
        case 'shoulders': return ExerciseBodyPartEnum.SHOULDERS;
        case 'traps': return ExerciseBodyPartEnum.TRAPS;
        case 'triceps': return ExerciseBodyPartEnum.TRICEPS;
        case 'biceps': return ExerciseBodyPartEnum.BICEPS;
        case 'core': return ExerciseBodyPartEnum.CORE;
        case 'legs': return ExerciseBodyPartEnum.LEGS;
        case 'calves': return ExerciseBodyPartEnum.CALVES;
        case 'full body': return ExerciseBodyPartEnum.FULL_BODY;
        case 'cardio': return ExerciseBodyPartEnum.CARDIO;
        default: return ExerciseBodyPartEnum.OTHER;
    }
};
