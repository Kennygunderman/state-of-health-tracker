const baseApiUrl = "http://192.168.4.104:3000/api";

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  WorkoutDay: `${baseApiUrl}/workout/:day`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
}

export default Endpoints;
