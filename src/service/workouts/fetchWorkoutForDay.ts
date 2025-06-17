import { WorkoutDay } from "../../data/models/WorkoutDay";
import { httpGet } from "../http/httpUtil";
import CrashUtility from "../../utility/CrashUtility";
import { mapExerciseBodyPart, mapExerciseType } from "../../store/exercises/utils/ExerciseConverter";
import * as io from 'io-ts';

const ExerciseSetResponse = io.type({
  id: io.string,
  reps: io.number,
  weight: io.number,
  completed: io.boolean,
});

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string,
});

const DailyExerciseResponse = io.type({
  dailyExerciseId: io.string,
  exercise: ExerciseResponse,
  sets: io.array(ExerciseSetResponse),
});

const WorkoutDayResponse = io.type({
  id: io.string,
  date: io.string,
  dailyExercises: io.array(DailyExerciseResponse),
});

export async function fetchWorkoutForDay(
  isoDayStamp: string,
  userId: string
): Promise<WorkoutDay> {
  try {
    const response = await httpGet(
      `http://192.168.4.104:3000/api/workouts/${isoDayStamp}`,
      WorkoutDayResponse,
      {
        headers: {
          'x-user-id': userId,
        },
      }
    );

    if (!response) throw new Error('Workout not found');

    return {
      id: response.id,
      date: response.date,
      userId: userId,
      dailyExercises: response.dailyExercises.map((entry) => ({
        id: entry.dailyExerciseId,
        dailyExerciseId: entry.dailyExerciseId,
        exercise: {
          id: entry.exercise.id,
          name: entry.exercise.name,
          exerciseType: mapExerciseType(entry.exercise.exerciseType),
          exerciseBodyPart: mapExerciseBodyPart(entry.exercise.exerciseBodyPart),
          latestCompletedSets: [],
        },
        sets: entry.sets,
      })),
    };
  } catch (error) {

    CrashUtility.recordError(error);
    throw error;
  }
}
