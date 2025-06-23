import {CreateExerciseTemplatePayload, ExerciseTemplate} from '@data/models/ExerciseTemplate'
import {httpPost} from '@service/http/httpUtil'
import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import CrashUtility from '../../utility/CrashUtility'

const TemplateResponse = io.type({
  id: io.string,
  userId: io.string,
  name: io.string,
  tagline: io.string,
  exerciseIds: io.array(io.string)
})

export async function createTemplate(payload: CreateExerciseTemplatePayload): Promise<ExerciseTemplate> {
  try {
    const response = await httpPost(Endpoints.Template, TemplateResponse, payload)

    if (!response || !response.data) {
      throw new Error('Invalid response when creating template')
    }

    return {
      id: response.data.id,
      userId: response.data.userId,
      name: response.data.name,
      tagline: response.data.tagline,
      exerciseIds: response.data.exerciseIds
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
