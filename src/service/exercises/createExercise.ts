import * as io from 'io-ts';
import { httpPost } from '../http/httpUtil';
import CrashUtility from '../../utility/CrashUtility';
import Endpoints from '../../constants/Endpoints';
import { CreateExercisePayload, Exercise } from "../../data/models/Exercise";
import { mapExerciseBodyPart, mapExerciseType } from "../../data/converters/ExerciseConverter";

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string,
});

export async function createExercise(
  payload: CreateExercisePayload
): Promise<Exercise> {
  try {
    const response = await httpPost(
      Endpoints.CreateExercise,
      ExerciseResponse,
      payload
    );

    if (!response || !response.data) {
      throw new Error('Invalid response when creating exercise');
    }

    return {
      id: response.data.id,
      name: response.data.name,
      exerciseType: mapExerciseType(response.data.exerciseType),
      exerciseBodyPart: mapExerciseBodyPart(response.data.exerciseBodyPart),
      latestCompletedSets: [],
    }
  } catch (error) {
    CrashUtility.recordError(error);
    throw error;
  }
}
