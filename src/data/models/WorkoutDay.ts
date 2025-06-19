import { v4 as uuidv4 } from 'uuid';

import { DailyExercise } from "./DailyExercise";
import Unique from "../../store/models/Unique";

export interface WorkoutDay extends Unique {
  id: string;
  userId: string;
  date: string;
  dailyExercises: DailyExercise[];
  synced?: boolean; // Optional field to track if the workout day has been synced
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
