export interface ExerciseTemplate {
  id: string;
  userId: string;
  name: string;
  tagline: string;
  exerciseIds: string[];
}

export interface CreateExerciseTemplatePayload {
  name: string;
  tagline: string;
  exerciseIds: string[];
}

export function isExerciseTemplate(obj: any): obj is ExerciseTemplate {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'userId' in obj &&
    'name' in obj &&
    'tagline' in obj &&
    Array.isArray(obj.exerciseIds)
  );
}
