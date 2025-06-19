import { capitalizeFirstLetterOfEveryWord } from '../../utility/TextUtility';
import { CreateExercisePayload } from '../../data/models/Exercise';
import { mapExerciseBodyPart, mapExerciseType } from '../../data/converters/ExerciseConverter';
import exercises from '../../assets/exercises';

class ExerciseSearchService {
  private formatExercise(exercise: typeof exercises[number]): CreateExercisePayload {
    return {
      name: capitalizeFirstLetterOfEveryWord(exercise.name),
      exerciseType: mapExerciseType(exercise.type),
      exerciseBodyPart: mapExerciseBodyPart(exercise.muscleGroup),
    };
  }

  searchExercises(term: string = '', limit: number = 50): CreateExercisePayload[] {
    const normalizedTerm = term.trim()
      .toLowerCase();

    const filtered = !normalizedTerm
      ? exercises
      : exercises.filter((exercise) => {
        const name = exercise.name.toLowerCase();
        const muscleGroup = exercise.muscleGroup.toLowerCase();
        const type = exercise.type.toLowerCase();
        return (
          name.includes(normalizedTerm) ||
          muscleGroup.includes(normalizedTerm) ||
          type.includes(normalizedTerm)
        );
      });

    const sorted = filtered
      .map(this.formatExercise)
      .sort((a, b) => a.name.localeCompare(b.name));

    return sorted.slice(0, limit);
  }
}

const exerciseSearchService = new ExerciseSearchService();
export default exerciseSearchService;
