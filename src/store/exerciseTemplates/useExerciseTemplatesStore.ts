import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchTemplates } from '../../service/exercises/fetchTemplates';
import { ExerciseTemplate } from "../../data/models/ExerciseTemplate";

export type ExerciseTemplatesState = {
  templates: ExerciseTemplate[];
  fetchTemplates: () => Promise<void>;
};

const useExerciseTemplatesStore = create<ExerciseTemplatesState>()(
  immer((set) => ({
    templates: [],
    fetchTemplates: async () => {
      try {
        const userId = 'BCsEDn7nMXatgkegN83pTksIcGs2';
        const templates = await fetchTemplates(userId);
        set({templates})
      } catch (error) {
        // no-op, gracefully handle errors
      }
    },
  }))
);

export default useExerciseTemplatesStore;
