import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'

import {DELETE_TEMPLATE_ERROR, DELETE_TEMPLATE_SUCCESS} from '@constants/Strings'
import {ExerciseScreenUpdateSubject$} from '@screens/AddExercise'
import {CreateTemplateEventSubject$} from '@screens/CreateTemplate'

import {CreateExerciseTemplatePayload, ExerciseTemplate} from '../../data/models/ExerciseTemplate'
import {createTemplate} from '../../service/exercises/createTemplate'
import {deleteTemplate} from '../../service/exercises/deleteTemplate'
import {fetchTemplates} from '../../service/exercises/fetchTemplates'

export type ExerciseTemplateState = {
  templates: ExerciseTemplate[]
  selectedTemplate: ExerciseTemplate | null
  removeExerciseFromAllTemplates: (exerciseId: string) => void
  setSelectedTemplate: (template: ExerciseTemplate) => void
  fetchTemplates: () => Promise<void>
  createTemplate: (template: CreateExerciseTemplatePayload) => Promise<void>
  deleteTemplate: (templateName: string, templateId: string) => Promise<void>
}

const useExerciseTemplateStore = create<ExerciseTemplateState>()(
  immer((set, get) => ({
    templates: [],
    selectedTemplate: null,
    setSelectedTemplate: (template: ExerciseTemplate) => set({selectedTemplate: template}),
    removeExerciseFromAllTemplates: (exerciseId: string) =>
      set(state => {
        state.templates.forEach(template => {
          template.exerciseIds = template.exerciseIds.filter(id => id !== exerciseId)
        })
      }),
    fetchTemplates: async () => {
      try {
        const templates = await fetchTemplates()
        set({templates})
      } catch (error) {
        // no-op, gracefully handle errors
      }
    },
    createTemplate: async (template: CreateExerciseTemplatePayload) => {
      const {templates} = get()
      try {
        const templatedCreated = await createTemplate(template)
        set({templates: [...templates, templatedCreated]})
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
    deleteTemplate: async (templateName: string, templateId: string) => {
      try {
        ExerciseScreenUpdateSubject$.next({isUpdating: true})
        await deleteTemplate(templateId)

        const {templates} = get()
        set({templates: templates.filter(template => template.id !== templateId)})
        ExerciseScreenUpdateSubject$.next({
          isUpdating: false,
          updatePayload: {
            success: true,
            message: DELETE_TEMPLATE_SUCCESS,
            message2: templateName
          }
        })
      } catch (error) {
        ExerciseScreenUpdateSubject$.next({
          isUpdating: false,
          updatePayload: {
            success: false,
            message: DELETE_TEMPLATE_ERROR
          }
        })
      }
    }
  }))
)

export default useExerciseTemplateStore
