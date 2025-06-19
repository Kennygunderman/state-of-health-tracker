import { capitalizeFirstLetterOfEveryWord } from '../../utility/TextUtility';

import { combineExerciseNameType, Exercise } from "../../data/models/Exercise";
import { mapExerciseBodyPart, mapExerciseType } from "../../data/converters/ExerciseConverter";
import exercises from "./exercises";

class ExerciseSearchService {
  searchExercises(term: string, limit: number = 100): Exercise[] {
    return []
    // return exercises
    //   .filter((exercise) =>
    //     exercise.name.toLowerCase()
    //       .includes(term.toLowerCase())
    //   )
    //   .slice(0, limit)
    //   .map((exercise) => {
    //     const exerciseName = capitalizeFirstLetterOfEveryWord(exercise.name);
    //     const exerciseType = mapExerciseType(exercise.type);
    //
    //     return createExercise(
    //       createExerciseName(exerciseName, exerciseType),
    //       exerciseType,
    //       mapExerciseBodyPart(exercise.muscleGroup)
    //     );
    //   });
  }
}

const exerciseSearchService = new ExerciseSearchService();
export default exerciseSearchService;
