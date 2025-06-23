import {CreateExercisePayload, Exercise} from '@data/models/Exercise'
import {createExercise} from '@service/exercises/createExercise'
import {deleteExercise} from '@service/exercises/deleteExercise'
import {fetchExercises} from '@service/exercises/fetchExercises'
import useExerciseTemplateStore from '@store/exerciseTemplates/useExerciseTemplateStore'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'

import {ExerciseScreenUpdateSubject$} from '@screens/AddExercise'
import {CreateExerciseEvent, CreateExerciseEventSubject$} from '@screens/CreateExercise'

import {DELETE_EXERCISE_ERROR, DELETE_EXERCISE_SUCCESS} from '@constants/Strings'

export type ExercisesState = {
  exercises: Exercise[]
  findExercise: (name: string, type: string) => Exercise | undefined
  getExercises: (exerciseIds: string[]) => Exercise[]
  getFilterExercises: (filter: string) => Exercise[]
  fetchExercises: () => Promise<void>
  createExercise: (exercise: CreateExercisePayload) => Promise<void>
  deleteExercise: (exerciseId: string) => Promise<void>
}

const useExercisesStore = create<ExercisesState>()(
  immer((set, get) => ({
    exercises: [],
    findExercise: (name: string, type: string) => {
      const exercises = get().exercises

      return exercises.find(e => e.name === name && e.exerciseType === type)
    },
    getExercises: (exerciseIds: string[]) => {
      const exercises = get().exercises

      return exercises.filter(exercise => exerciseIds.includes(exercise.id))
    },
    getFilterExercises: (filter: string) => {
      const exercises = get().exercises

      if (!filter) return exercises

      return exercises.filter(
        exercise =>
          exercise.name.toLowerCase().includes(filter.toLowerCase()) ||
          exercise.exerciseType.toLowerCase().includes(filter.toLowerCase()) ||
          exercise.exerciseBodyPart.toLowerCase().includes(filter.toLowerCase())
      )
    },
    fetchExercises: async () => {
      try {
        const exercises = await fetchExercises()

        set(state => {
          state.exercises = exercises
        })
      } catch (error) {
        // gracefully handle the error
      }
    },
    createExercise: async (exercise: CreateExercisePayload) => {
      const {exercises, findExercise} = get()
      const existingExercise = findExercise(exercise.name, exercise.exerciseType)

      if (existingExercise) {
        CreateExerciseEventSubject$.next({
          event: CreateExerciseEvent.Exists,
          payload: exercise
        })

        return
      }

      try {
        const exerciseCreated = await createExercise(exercise)

        set({exercises: [...exercises, exerciseCreated]})
        CreateExerciseEventSubject$.next({
          event: CreateExerciseEvent.Created,
          payload: exercise
        })
      } catch (error) {
        CreateExerciseEventSubject$.next({
          event: CreateExerciseEvent.Error,
          payload: exercise
        })
      }
    },
    deleteExercise: async (exerciseId: string) => {
      try {
        ExerciseScreenUpdateSubject$.next({isUpdating: true})
        await deleteExercise(exerciseId)

        set(state => {
          state.exercises = state.exercises.filter(exercise => exercise.id !== exerciseId)
        })

        useExerciseTemplateStore.getState().removeExerciseFromAllTemplates(exerciseId)

        ExerciseScreenUpdateSubject$.next({
          isUpdating: false,
          updatePayload: {
            success: true,
            message: DELETE_EXERCISE_SUCCESS
          }
        })
      } catch (error) {
        ExerciseScreenUpdateSubject$.next({
          isUpdating: false,
          updatePayload: {
            success: false,
            message: DELETE_EXERCISE_ERROR
          }
        })
      }
    }
  }))
)

export default useExercisesStore
