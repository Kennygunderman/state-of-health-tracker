import { v4 as uuidv4 } from 'uuid';

import { DailyExercise } from "../../store/dailyExerciseEntries/models/DailyExercise";
import Unique from "../../store/models/Unique";

export interface WorkoutDay extends Unique {
  id: string;
  userId: string;
  date: string;
  dailyExercises: DailyExercise[];
}

export function createWorkoutDay(
  userId: string,
  date: string,
  dailyExercises: DailyExercise[] = []
): WorkoutDay {
  return {
    id: uuidv4(),
    userId,
    date,
    dailyExercises,
  };
}
