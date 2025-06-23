import {v4 as uuidv4} from 'uuid'

import Unique from '../../../data/models/Unique'

export interface DailyMealEntry extends Unique {
  userId?: string
  hasSynced: boolean // value to determine if meal entry needs to be synced to BE.
  mealIds: string[]
}

export function createDailyMealEntry(mealIds: string[] = []) {
  return {
    id: uuidv4(),
    hasSynced: false,
    mealIds
  }
}
