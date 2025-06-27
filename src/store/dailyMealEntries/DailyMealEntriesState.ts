import {DailyMealEntry} from './models/DailyMealEntry'

export default interface DailyMealEntriesState {
  map: DailyMealEntryMap
}

export interface DailyMealEntryMap {
  [date: string]: DailyMealEntry
}
