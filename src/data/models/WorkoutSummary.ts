export interface WorkoutSummary {
    day: string;
    workoutDayId: string;
    totalWeight: number;
    exercises: {
        setsCompleted: number;
        bestSet?: {
            weight: number;
            reps: number;
        };
        exercise: {
            name: string;
        };
    }[]
}
