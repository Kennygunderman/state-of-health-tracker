export const queryKeys = {
  exercises: ['exercises'] as const,
  templates: ['templates'] as const,
  workoutSummaries: ['workoutSummaries'] as const,
  weeklyWorkoutSummaries: ['weeklyWorkoutSummaries'] as const,
  records: ['records'] as const,
  exerciseHistories: ['exerciseHistory'] as const,
  exerciseHistory: (exerciseId: string) => ['exerciseHistory', exerciseId] as const,
  runs: ['runs'] as const,
  runsTotal: ['runsTotal'] as const,
  run: (runId: string) => ['run', runId] as const,
  weighIns: ['weighIns'] as const,
  activitySteps: ['activitySteps'] as const,
  dailySteps: (days: number) => ['activitySteps', 'daily', days] as const,
  hourlySteps: (days: number) => ['activitySteps', 'hourly', days] as const,
  runWindowSteps: (runsKey: string) => ['activitySteps', 'runWindows', runsKey] as const,
  healthAuthStatus: ['healthAuthStatus'] as const,
  dailyMacrosAll: ['dailyMacros'] as const,
  dailyMacros: (date: string) => ['dailyMacros', date] as const,
  macrosHistory: ['macrosHistory'] as const,
  foods: ['foods'] as const,
  foodSearch: (query: string) => ['foods', query] as const,
  brandedFoodSearch: (query: string) => ['brandedFoodSearch', query] as const,
  userAvatar: ['userAvatar'] as const,
  aiUsage: ['aiUsage'] as const,
  mealPlanPreferences: ['mealPlanPreferences'] as const,
  nutritionTargets: ['nutritionTargets'] as const,
  targetEstimate: ['targetEstimate'] as const,
  // Day-independent deliberately, even though which plan is current depends on today's date: this is the one
  // persisted read (PERSISTED_QUERY_KEYS matches this first segment), the entry useMealPlanDayQuery seeds
  // initialData from by exact key, and the root every plan mutation invalidates by prefix — so a day-suffixed
  // key would compile away the seed and leave a post-midnight offline cold start with no entry at all, which
  // AAP 0.2.5 forbids rendering as the no-plan state. Rollover is bound to freshness in
  // useCurrentMealPlanQuery instead, which refetches an answer fetched on an earlier day.
  mealPlanCurrent: ['mealPlanCurrent'] as const,
  mealPlanDayAll: ['mealPlanDay'] as const,
  mealPlanDay: (planId: string, date: string) => ['mealPlanDay', planId, date] as const,
  swapAlternativesAll: ['swapAlternatives'] as const,
  swapAlternatives: (planId: string, mealId: string, planRevision: number) =>
    ['swapAlternatives', planId, mealId, planRevision] as const,
  swapPreviewAll: ['swapPreview'] as const,
  swapPreview: (planId: string, mealId: string, recipeVersionId: string, planRevision: number) =>
    ['swapPreview', planId, mealId, recipeVersionId, planRevision] as const,
  groceryListAll: ['groceryList'] as const,
  groceryList: (planId: string) => ['groceryList', planId] as const,
  affectedMealsAll: ['affectedMeals'] as const,
  affectedMeals: (planId: string) => ['affectedMeals', planId] as const,
  recipeVersion: (recipeVersionId: string) => ['recipeVersion', recipeVersionId] as const,
  catalogSearch: (query: string) => ['catalogSearch', query] as const,
  catalogSuggestions: ['catalogSuggestions'] as const,
  // The meal-planning capability verdict the whole session shares: which of AAP 0.2.5's two unavailability
  // signals have been seen, and the Remote Config activation they were seen under. It is server-derived truth —
  // read out of the errors of the gated requests themselves — so it belongs in the query cache beside them
  // rather than in a client store or a module global.
  //
  // Deliberately absent from PERSISTED_QUERY_KEYS: the verdict is session-scoped, so a cold start probes the
  // gated routes once again, which is the forward-recovery path an operator re-enable needs (AAP 0.7.5). The
  // logout path's `queryClient.clear()` drops it with everything else, so no account inherits another's verdict.
  // Nothing fetches this entry — it has no queryFn and is written only by the entitlement recorder.
  mealPlanCapability: ['mealPlanCapability'] as const
}

export const mutationKeys = {
  completeWorkout: ['completeWorkout'] as const,
  createExercise: ['createExercise'] as const,
  deleteExercise: ['deleteExercise'] as const,
  createTemplate: ['createTemplate'] as const,
  deleteTemplate: ['deleteTemplate'] as const,
  completeRun: ['completeRun'] as const,
  discardRun: ['discardRun'] as const,
  syncOfflineRuns: ['syncOfflineRuns'] as const,
  logWeighIn: ['logWeighIn'] as const,
  deleteWeighIn: ['deleteWeighIn'] as const,
  requestHealthPermissions: ['requestHealthPermissions'] as const,
  logMealEntry: ['logMealEntry'] as const,
  updateMealEntry: ['updateMealEntry'] as const,
  deleteMealEntry: ['deleteMealEntry'] as const,
  estimateMacros: ['estimateMacros'] as const,
  scanNutritionLabel: ['scanNutritionLabel'] as const,
  createFood: ['createFood'] as const,
  deleteFood: ['deleteFood'] as const,
  updateAvatar: ['updateAvatar'] as const,
  saveSetupStep: ['saveSetupStep'] as const,
  savePreferences: ['savePreferences'] as const,
  saveNutritionTargets: ['saveNutritionTargets'] as const,
  generatePlan: ['generatePlan'] as const,
  regeneratePlan: ['regeneratePlan'] as const,
  swapMeal: ['swapMeal'] as const,
  toggleGroceryItem: ['toggleGroceryItem'] as const,
  uncheckAllGroceries: ['uncheckAllGroceries'] as const,
  logPlannedMeal: ['logPlannedMeal'] as const
}
