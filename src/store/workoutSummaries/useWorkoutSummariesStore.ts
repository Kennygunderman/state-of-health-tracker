import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchWorkoutSummaries } from '../../service/workouts/fetchWorkoutSummaries';
import { WorkoutSummary } from "../../data/models/WorkoutSummary";
import { Pagination } from "../../data/models/Pagination";

export type WorkoutSummariesState = {
  currentPage: number;
  paginationData: Pagination | null;
  summaries: WorkoutSummary[];
  isFetching: boolean;
  canFetchMore: boolean;
  fetchSummaries: () => Promise<void>;
};

const useWorkoutSummariesStore = create<WorkoutSummariesState>()(
  immer((set, get) => ({
    summaries: [],
    currentPage: 1,
    paginationData: null,
    canFetchMore: true,
    isFetching: false,
    fetchSummaries: async () => {
      if (get().isFetching || !get().canFetchMore) return;
      try {
        set({ isFetching: true });
        const { currentPage } = get();
        const { pagination, summaries } = await fetchWorkoutSummaries(currentPage);

        set((state) => {
          state.summaries.push(...summaries);
          state.paginationData = pagination;
        });

        if (currentPage < pagination.totalPages) {
          set({ currentPage: currentPage + 1, isFetching: false });
        } else {
          set({ canFetchMore: false, isFetching: false });
        }

      } catch (error) {
        set({ isFetching: false });
      }
    },
  }))
);

export default useWorkoutSummariesStore;
