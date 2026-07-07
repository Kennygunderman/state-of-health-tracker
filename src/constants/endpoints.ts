const baseApiUrl = 'https://stateofhealthapi.com/api'

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  Exercise: `${baseApiUrl}/exercise/`,
  Template: `${baseApiUrl}/template/`,
  Workout: `${baseApiUrl}/workout/`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
  WeeklyWorkoutSummary: `${baseApiUrl}/workouts/weekly-summary/7`,
  ExerciseTemplates: `${baseApiUrl}/templates`,
  User: `${baseApiUrl}/user`,
  UserAvatar: `${baseApiUrl}/user/avatar`,
  Records: `${baseApiUrl}/records`,
  ExerciseHistory: (exerciseId: string) => `${baseApiUrl}/exercises/${exerciseId}/history`,
  Run: `${baseApiUrl}/run/`,
  Runs: `${baseApiUrl}/runs`,
  WeighIn: `${baseApiUrl}/weigh-in/`,
  WeighIns: `${baseApiUrl}/weigh-ins`,
  DailyMacros: (date: string) => `${baseApiUrl}/macros/${date}`,
  MacrosHistory: `${baseApiUrl}/macros/history`,
  MacroMealEntries: (mealId: string) => `${baseApiUrl}/macros/meal/${mealId}/entries`,
  MacroEntry: (entryId: string) => `${baseApiUrl}/macros/entry/${entryId}`,
  MacroEstimate: `${baseApiUrl}/macros/estimate`,
  AiUsage: `${baseApiUrl}/macros/ai-usage`,
  MacroLabelScan: `${baseApiUrl}/macros/label-scan`,
  MacroTargets: `${baseApiUrl}/user/targets`,
  UserProfile: `${baseApiUrl}/user/profile`,
  CoachState: `${baseApiUrl}/coach/state`,
  Coach: `${baseApiUrl}/coach`,
  CoachEnroll: `${baseApiUrl}/coach/enroll`,
  CoachSettings: `${baseApiUrl}/coach/settings`,
  CoachCheckInAck: (planId: string) => `${baseApiUrl}/coach/checkin/${planId}/ack`,
  Foods: `${baseApiUrl}/foods`,
  Food: (foodId: string) => `${baseApiUrl}/foods/${foodId}`,
  BrandedFoodSearch: (query: string) => `${baseApiUrl}/macros/search-branded-foods?q=${encodeURIComponent(query)}`
}

export default Endpoints
