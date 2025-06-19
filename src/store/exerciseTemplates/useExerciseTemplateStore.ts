import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchTemplates } from '../../service/exercises/fetchTemplates';
import { ExerciseTemplate } from "../../data/models/ExerciseTemplate";

export type ExerciseTemplateState = {
  templates: ExerciseTemplate[];
  selectedTemplate: ExerciseTemplate | null;
  setSelectedTemplate: (template: ExerciseTemplate) => void;
  fetchTemplates: () => Promise<void>;
};

const useExerciseTemplateStore = create<ExerciseTemplateState>()(
  immer((set) => ({
    templates: [],
    selectedTemplate: null,
    setSelectedTemplate: (template: ExerciseTemplate) => set({ selectedTemplate: template }),
    fetchTemplates: async () => {
      try {
        const templates = await fetchTemplates();
        set({templates})
      } catch (error) {
        // no-op, gracefully handle errors
      }
    },
  }))
);

export default useExerciseTemplateStore;
