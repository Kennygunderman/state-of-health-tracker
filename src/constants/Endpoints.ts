const baseApiUrl = "http://192.168.4.104:3000/api";

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  Exercise: `${baseApiUrl}/exercise/`,
  Template: `${baseApiUrl}/template/`,
  WorkoutDay: `${baseApiUrl}/workout/:day`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
  SaveWorkout: `${baseApiUrl}/workout`,
  WeeklyWorkoutSummary: `${baseApiUrl}/workouts/weekly-summary/7`,
  ExerciseTemplates: `${baseApiUrl}/templates`,
}

export default Endpoints;
