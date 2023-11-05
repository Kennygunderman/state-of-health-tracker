import { isMonday } from 'date-fns';
import { createSelector, ParametricSelector, Selector } from 'reselect';
import { DailyExerciseMap } from '../store/dailyExerciseEntries/DailyExerciseEntriesState';
import { DailyExercise } from '../store/dailyExerciseEntries/models/DailyExercise';
import { ExerciseMap } from '../store/exercises/ExercisesState';
import { Exercise } from '../store/exercises/models/Exercise';
import { ExerciseSet } from '../store/exercises/models/ExerciseSet';
import { WorkoutTemplate } from '../store/exercises/models/WorkoutTemplate';
import LocalStore from '../store/LocalStore';
import { formatDate, formatDateToMonthDay } from '../utility/DateUtility';

export interface ExerciseEntry {
    setsCompleted: number;
    bestSet?: ExerciseSet;
    exercise: DailyExercise;
}

export interface DailyExerciseEntry {
    day: string;
    totalWeight: number;
    exercises: ExerciseEntry[];
}

function getExercisesForDay(dailyExercisesMap: DailyExerciseMap, day: string): DailyExercise[] {
    if (Object.keys(dailyExercisesMap).length === 0) {
        return [];
    }

    return dailyExercisesMap[day] ?? [];
}

export const getExercisesForDaySelector: Selector<LocalStore, DailyExercise[]> = createSelector(
    (state: LocalStore) => state.dailyExerciseEntries.map,
    (state: LocalStore) => state.userInfo.currentDate,
    getExercisesForDay,
);

function getExercises(filter: string, exerciseMap: ExerciseMap): Exercise[] {
    let exercises: Exercise[] = [];

    if (Object.keys(exerciseMap).length === 0) {
        return [];
    }

    Object.keys(exerciseMap).forEach((key) => {
        exercises.push(exerciseMap[key]);
    });

    exercises = exercises.sort((a, b) => a.name.localeCompare(b.name));

    return filter === '' ? exercises : exercises.filter((exercise) => exercise.name.toLowerCase().includes(filter.toLowerCase())
        || exercise.exerciseBodyPart.toLowerCase().includes(filter.toLowerCase()));
}

export const getExercisesSelector: ParametricSelector<LocalStore, string, Exercise[]> = createSelector(
    (_: LocalStore, filter: string) => filter,
    (state: LocalStore) => state.exercises.map,
    getExercises,
);

function getTemplates(filter: string, templates: WorkoutTemplate[]): WorkoutTemplate[] {
    return templates.filter((template) => template.name.includes(filter));
}

export const getTemplatesSelector: ParametricSelector<LocalStore, string, WorkoutTemplate[]> = createSelector(
    (_: LocalStore, filter: string) => filter,
    (state: LocalStore) => state.exercises.templates,
    getTemplates,
);

function getPreviousDailyExerciseEntries(loadBatch: number, currentDay: string, dailyExerciseMap: DailyExerciseMap): DailyExerciseEntry[] {
    const entries: DailyExerciseEntry[] = [];

    const days: string[] = [];

    Object.keys(dailyExerciseMap).forEach((day) => {
        days.push(day);
    });

    days.sort((a, b) => Date.parse(b) - Date.parse(a))
        .filter((day) => day !== currentDay)
        .slice(0, loadBatch)
        .forEach((day) => {
            const exercises = getExercisesForDay(dailyExerciseMap, day);

            let totalWeight = 0;
            const exerciseEntries: ExerciseEntry[] = [];
            exercises.forEach((exercise) => {
                let sets = 0;
                let bestSet: ExerciseSet | undefined;
                exercise.sets.forEach((set) => {
                    const setWeight = (set.weight ?? 0) * (set.reps ?? 0);
                    totalWeight += setWeight;
                    if (setWeight > 0) {
                        sets++;
                    }

                    if ((bestSet?.weight ?? 0) * (bestSet?.reps ?? 0) < setWeight) {
                        bestSet = set;
                    }
                });

                if (sets === 0) {
                    return;
                }

                const exerciseEntry: ExerciseEntry = {
                    setsCompleted: sets,
                    bestSet,
                    exercise,
                };
                exerciseEntries.push(exerciseEntry);
            });

            if (totalWeight === 0) {
                return;
            }

            entries.push({
                day,
                totalWeight,
                exercises: exerciseEntries,
            });
        });

    return entries;
}

export const getPreviousDailyExerciseEntriesSelector: ParametricSelector<LocalStore, number, DailyExerciseEntry[]> = createSelector(
    (state: LocalStore, loadBatch: number) => loadBatch,
    (state: LocalStore, _: number) => state.userInfo.currentDate,
    (state: LocalStore, _: number) => state.dailyExerciseEntries.map,
    getPreviousDailyExerciseEntries,
);

function getNumberOfExercisesForLast7Weeks(currentDate: string, dailyExerciseMap: DailyExerciseMap): { [date: string]: number } {
    const completedWorkoutsMap: { [date: string]: number } = {};

    const last7Mondays = [];
    let daysAgo = 0;
    const oneDayMs = 1000 * 60 * 60 * 24; // 1000 ms * 60s * 60m * 24h
    let mostRecentMonday = Date.now();
    while (!isMonday(mostRecentMonday)) {
        daysAgo++;
        mostRecentMonday = Date.now() - (oneDayMs * daysAgo);
    }

    for (let i = 0; i < 7; i++) {
        last7Mondays.push(mostRecentMonday - i * (oneDayMs * 7));
    }

    last7Mondays.forEach((monday) => {
        let workoutsComplete = 0;
        for (let i = 0; i < 7; i++) {
            const date = formatDate(monday + (oneDayMs * i));
            if (date !== currentDate) {
                const dailyExercises = dailyExerciseMap[date] ?? [];
                let totalWeightForDay = 0;
                dailyExercises.forEach((dailyExercise) => {
                    dailyExercise.sets.forEach((set) => {
                        totalWeightForDay += (set.weight ?? 0) * (set.reps ?? 0);
                    });
                });

                if (totalWeightForDay > 0) {
                    workoutsComplete++;
                }
            }

            completedWorkoutsMap[formatDateToMonthDay(monday)] = workoutsComplete;
        }
    });

    return completedWorkoutsMap;
}

export const getNumberOfWorkoutsForLast7WeeksSelector: Selector<LocalStore, { [date: string]: number }> = createSelector(
    (state: LocalStore) => state.userInfo.currentDate,
    (state: LocalStore) => state.dailyExerciseEntries.map,
    getNumberOfExercisesForLast7Weeks,
);
