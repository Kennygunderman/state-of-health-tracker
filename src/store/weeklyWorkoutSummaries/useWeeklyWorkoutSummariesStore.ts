import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchWeeklyWorkoutSummaries } from '../../service/workouts/fetchWeeklyWorkoutSummaries';
import { WeeklyWorkoutSummary } from '../../data/models/WeeklyWorkoutSummary';

export type WeeklyWorkoutSummariesState = {
  isLoadingSummaries: boolean;
  weeklySummaries: WeeklyWorkoutSummary[];
  fetchWeeklySummaries: () => Promise<void>;
};

const useWeeklyWorkoutSummariesStore = create<WeeklyWorkoutSummariesState>()(
  immer((set) => ({
    isLoadingSummaries: false,
    weeklySummaries: [],
    fetchWeeklySummaries: async () => {
      try {
        set({ isLoadingSummaries: true });
        const summaries = await fetchWeeklyWorkoutSummaries('BCsEDn7nMXatgkegN83pTksIcGs2');
        set({ weeklySummaries: summaries, isLoadingSummaries: false });
      } catch (error) {
        set({ isLoadingSummaries: false });
      }
    },
  }))
);

export default useWeeklyWorkoutSummariesStore;
