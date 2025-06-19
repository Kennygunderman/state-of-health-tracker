import * as io from 'io-ts';
import CrashUtility from '../../utility/CrashUtility';
import Endpoints from '../../constants/Endpoints';
import { httpGet } from '../http/httpUtil';
import { ExerciseTemplate } from "../../data/models/ExerciseTemplate";

// Define io-ts codec for the API response
const ExerciseTemplateResponse = io.type({
  id: io.string,
  userId: io.string,
  name: io.string,
  tagline: io.string,
  exerciseIds: io.array(io.string),
});

const ExerciseTemplateArrayResponse = io.type({
  templates: io.array(ExerciseTemplateResponse),
});

export async function fetchTemplates(userId: string): Promise<ExerciseTemplate[]> {
  try {
    const response = await httpGet(
      Endpoints.ExerciseTemplates,
      ExerciseTemplateArrayResponse,
      {
        headers: {
          'x-user-id': userId,
        },
      }
    );

    const data = response?.data;

    if (!response || !data) throw new Error('No templates found');

    return data.templates.map((template) => ({
      id: template.id,
      userId: template.userId,
      name: template.name,
      tagline: template.tagline,
      exerciseIds: template.exerciseIds,
    }));
  } catch (error) {
    CrashUtility.recordError(error);
    throw error;
  }
}
