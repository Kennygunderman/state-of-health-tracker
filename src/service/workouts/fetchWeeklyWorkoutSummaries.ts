import { httpGet } from "../http/httpUtil";
import CrashUtility from "../../utility/CrashUtility";
import * as io from "io-ts";
import { WeeklyWorkoutSummary } from "../../data/models/WeeklyWorkoutSummary";
import Endpoints from "../../constants/Endpoints";

const WeeklyWorkoutSummaryResponse = io.type({
  startOfWeek: io.string,
  completedWorkouts: io.number,
});

const WeeklyWorkoutSummariesResponse = io.array(WeeklyWorkoutSummaryResponse);

export async function fetchWeeklyWorkoutSummaries(userId: string): Promise<WeeklyWorkoutSummary[]> {
  try {
    const response = await httpGet(
      Endpoints.WeeklyWorkoutSummary,
      WeeklyWorkoutSummariesResponse,
      {
        headers: {
          "x-user-id": userId,
        },
      }
    );

    const data = response?.data;

    if (!Array.isArray(data)) {
      throw new Error("Invalid weekly workout summary response");
    }

    return data;
  } catch (error) {
    CrashUtility.recordError(error);
    throw error;
  }
}
