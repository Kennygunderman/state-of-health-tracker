import * as io from 'io-ts';
import { httpDelete } from '../http/httpUtil'; // assumes httpDelete exists
import CrashUtility from '../../utility/CrashUtility';
import Endpoints from '../../constants/Endpoints';

const VoidResponse = io.unknown;

export async function deleteExercise(exerciseId: string): Promise<boolean> {
  try {
    const response = await httpDelete(
      `${Endpoints.Exercise}${exerciseId}`,
      VoidResponse
    );

    if (response?.status !== 204) {
      throw new Error(`Unexpected response status: ${response?.status}`);
    }

    return true;
  } catch (error) {
    CrashUtility.recordError(error);
    throw error;
  }
}
