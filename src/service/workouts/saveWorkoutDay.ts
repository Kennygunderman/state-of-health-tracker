import { WorkoutDay } from "../../data/models/WorkoutDay";
import { httpPost } from "../http/httpUtil";
import CrashUtility from "../../utility/CrashUtility";
import Endpoints from "../../constants/Endpoints";
import * as io from 'io-ts';

const VoidResponse = io.unknown; // Accepts any response (even empty)

export async function saveWorkoutDay(
  userId: string,
  workoutDay: WorkoutDay
): Promise<boolean> {
  try {
    const response = await httpPost(
      Endpoints.SaveWorkout,
      VoidResponse,
      {
        headers: {
          'x-user-id': userId,
        },
      },
      workoutDay
    );

    if (response?.status != 201) {
      throw new Error(`Unexpected response status: ${response?.status}`);
    }

    console.log('Workout synced!!')

    return true;
  } catch (error) {
    CrashUtility.recordError(error);
    console.error('Failed to save workout day:', error);
    return false;
  }
}
