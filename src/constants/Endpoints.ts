const baseApiUrl = 'https://stateofhealthapi.com/api'

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  Exercise: `${baseApiUrl}/exercise/`,
  Template: `${baseApiUrl}/template/`,
  Workout: `${baseApiUrl}/workout/`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
  SaveWorkout: `${baseApiUrl}/workout`,
  WeeklyWorkoutSummary: `${baseApiUrl}/workouts/weekly-summary/7`,
  ExerciseTemplates: `${baseApiUrl}/templates`,
  User: `${baseApiUrl}/user`
}

export default Endpoints
