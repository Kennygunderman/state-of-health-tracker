import { httpGet } from "../http/httpUtil";
import CrashUtility from "../../utility/CrashUtility";
import * as io from 'io-ts';
import Endpoints from "../../constants/Endpoints";
import { WorkoutSummary } from "../../data/models/WorkoutSummary";

const BestSetResponse = io.type({
  weight: io.number,
  reps: io.number,
});

const ExerciseSummaryResponse = io.type({
  setsCompleted: io.number,
  bestSet: io.union([BestSetResponse, io.undefined]),
  exercise: io.type({
    name: io.string,
  }),
});

const WorkoutSummaryResponse = io.type({
  workoutDayId: io.string,
  day: io.string,
  totalWeight: io.number,
  exercises: io.array(ExerciseSummaryResponse),
});

const WorkoutSummariesApiResponse = io.type({
  summaries: io.array(WorkoutSummaryResponse),
  pagination: io.type({
    page: io.number,
    limit: io.number,
    total: io.number,
    totalPages: io.number,
  }),
});

export async function fetchWorkoutSummaries(): Promise<WorkoutSummary[]> {
  try {
    const response = await httpGet(
      Endpoints.WorkoutSummaries,
      WorkoutSummariesApiResponse
    );

    const data = response?.data

    if (!data?.summaries) throw new Error('No workout summaries returned');

    return data?.summaries

  } catch (error) {
    CrashUtility.recordError(error);
    throw error;
  }
}
