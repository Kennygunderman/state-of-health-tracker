import axios from 'axios';
import { Either, isLeft } from 'fp-ts/lib/Either';
import * as io from 'io-ts';
import { Errors } from 'io-ts';
import CrashUtility from '../../utility/CrashUtility';
import { capitalizeFirstLetterOfEveryWord } from '../../utility/TextUtility';

import { SOH_API_KEY, SOH_API_BASE_URL } from '@env';
import { createExercise, createExerciseName, Exercise } from "../../store/exercises/models/Exercise";
import { mapExerciseBodyPart, mapExerciseType } from "../../store/exercises/utils/ExerciseConverter";
import exercises from "./exercises";

interface IExerciseSearchService {
    searchExercises: (term: string, limit: number, onFetched: (exercises: Exercise[]) => void) => void;
}

const ExerciseItemResponse = io.type({
    exercise_name: io.string,
    muscle_group: io.string,
    exercise_type: io.string,
});

const ExerciseSearchResponse = io.type({
    number_of_results: io.number,
    results: io.array(ExerciseItemResponse),
});

class ExerciseSearchService implements IExerciseSearchService {
    searchExercises(term: string, limit: number, onFetched: (exercises: Exercise[]) => void): void {
         const filteredExercises = exercises
                .filter((exercise) =>
                    exercise.name.toLowerCase().includes(term.toLowerCase())
                )
                .slice(0, limit)
                .map((exercise) => {
                    const exerciseName = capitalizeFirstLetterOfEveryWord(exercise.name);
                    const exerciseType = mapExerciseType(exercise.type);
                    return createExercise(
                        createExerciseName(exerciseName, exerciseType),
                        exerciseType,
                        mapExerciseBodyPart(exercise.muscleGroup)
                    );
                });

            onFetched(filteredExercises);

            return;


        const options = {
            method: 'GET',
            url: `${SOH_API_BASE_URL}/exercises/search?term=${term}&limit=${limit}`,
            headers: {
                'x-api-key': SOH_API_KEY,
            }
        };

        axios
            .request(options)
            .then(({ data }: { data: any }) => {
                const decode = (decoded: object) => ExerciseSearchResponse.decode(decoded);
                const decodedData: Either<Errors, any> = decode(data);
                if (isLeft(decodedData)) {
                    // decode failed
                    CrashUtility.recordError(Error(`Error searching exercises ${decodedData.left}`));
                    onFetched([]);
                    return;
                }

                const exercises: Exercise[] = decodedData.right.results.map((exerciseResponse: any) => {
                        const exerciseName = capitalizeFirstLetterOfEveryWord(exerciseResponse.exercise_name);
                        const exerciseType = mapExerciseType(exerciseResponse.exercise_type)
                        const exercise = createExercise(
                            createExerciseName(exerciseName, exerciseType),
                            mapExerciseType(exerciseResponse.exercise_type),
                            mapExerciseBodyPart(exerciseResponse.muscle_group)
                        );

                        return {
                            ...exercise,
                            source: 'remote',
                        }
                    }
                );

                onFetched(exercises);
            })
            .catch((error: any) => {
                CrashUtility.recordError(error);
                onFetched([]);
            });
    }
}

const exerciseSearchService = new ExerciseSearchService() as IExerciseSearchService;
export default exerciseSearchService;
