import { ExerciseTypeEnum } from "../data/models/Exercise";

export function combineExerciseNameType(exerciseName: string, exerciseType: ExerciseTypeEnum): string {
  let name: string = exerciseName;
  if (exerciseType !== ExerciseTypeEnum.OTHER) {
    name += ` (${exerciseType})`;
  }

  return name;
}
