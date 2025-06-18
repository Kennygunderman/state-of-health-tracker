import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchWorkoutSummaries } from '../../service/workouts/fetchWorkoutSummaries';
import { WorkoutSummary } from "../../data/models/WorkoutSummary";

export type WorkoutSummariesState = {
  summaries: WorkoutSummary[];
  fetchSummaries: () => Promise<void>;
};

const useWorkoutSummariesStore = create<WorkoutSummariesState>()(
  immer((set) => ({
    summaries: [],
    fetchSummaries: async () => {
      try {
        const summaries = await fetchWorkoutSummaries('03wD83qf64Oq5YSXOd2plYifhoA2');

        set((state) => {
          state.summaries = summaries;
        });
      } catch (error) {
        console.error('Failed to fetch workout summaries', error);
      }
    },
  }))
);

export default useWorkoutSummariesStore;
