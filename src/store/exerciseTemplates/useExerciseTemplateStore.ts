import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchTemplates } from '../../service/exercises/fetchTemplates';
import { CreateExerciseTemplatePayload, ExerciseTemplate } from "../../data/models/ExerciseTemplate";
import { createTemplate } from "../../service/exercises/createTemplate";
import { CreateTemplateEventSubject$ } from "../../screens/CreateTemplate";

export type ExerciseTemplateState = {
  templates: ExerciseTemplate[];
  selectedTemplate: ExerciseTemplate | null;
  removeExerciseFromAllTemplates: (exerciseId: string) => void;
  setSelectedTemplate: (template: ExerciseTemplate) => void;
  fetchTemplates: () => Promise<void>;
  createTemplate: (template: CreateExerciseTemplatePayload) => Promise<void>;
};

const useExerciseTemplateStore = create<ExerciseTemplateState>()(
  immer((set, get) => ({
    templates: [],
    selectedTemplate: null,
    setSelectedTemplate: (template: ExerciseTemplate) => set({ selectedTemplate: template }),
    removeExerciseFromAllTemplates: (exerciseId: string) =>
      set((state) => {
        state.templates.forEach((template) => {
          template.exerciseIds = template.exerciseIds.filter(
            (id) => id !== exerciseId
          );
        });
      }),
    fetchTemplates: async () => {
      try {
        const templates = await fetchTemplates();
        set({templates})
      } catch (error) {
        // no-op, gracefully handle errors
      }
    },
    createTemplate: async (template: CreateExerciseTemplatePayload) => {
      const { templates } = get();
      try {
        const templatedCreated = await createTemplate(template);
        set({ templates: [...templates, templatedCreated]});
        CreateTemplateEventSubject$.next({
          success: true,
          message: templatedCreated.name
        })
      } catch (error) {
        CreateTemplateEventSubject$.next({
          success: false,
          message: ''
        })
      }
    },
  }))
);

export default useExerciseTemplateStore;
