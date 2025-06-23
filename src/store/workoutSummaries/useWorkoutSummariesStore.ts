import {WorkoutSummary} from '@data/models/WorkoutSummary'
import {fetchWorkoutSummaries} from '@service/workouts/fetchWorkoutSummaries'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'

export type WorkoutSummariesState = {
  currentPage: number
  summaries: WorkoutSummary[]
  totalSummaries: number
  isFetching: boolean
  canFetchMore: boolean
  fetchSummaries: () => Promise<void>
}

const useWorkoutSummariesStore = create<WorkoutSummariesState>()(
  immer((set, get) => ({
    summaries: [],
    totalSummaries: 0,
    currentPage: 1,
    canFetchMore: true,
    isFetching: false,
    fetchSummaries: async () => {
      if (get().isFetching || !get().canFetchMore) return
      try {
        set({isFetching: true})
        const {currentPage} = get()
        const {pagination, summaries} = await fetchWorkoutSummaries(currentPage)

        set(state => {
          state.summaries.push(...summaries)
          state.totalSummaries = pagination.total
        })

        if (currentPage < pagination.totalPages) {
          set({
            currentPage: currentPage + 1,
            isFetching: false
          })
        } else {
          set({
            canFetchMore: false,
            isFetching: false
          })
        }
      } catch (error) {
        set({isFetching: false})
      }
    }
  }))
)

export default useWorkoutSummariesStore
