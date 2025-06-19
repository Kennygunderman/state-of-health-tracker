import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Picker, { PickerItem } from '../components/Picker';
import PrimaryButton from '../components/PrimaryButton';
import TextInputWithHeader from '../components/TextInputWithHeader';
import { showToast } from '../components/toast/util/ShowToast';
import Spacing from '../constants/Spacing';
import {
    CREATE_EXERCISE_BODY_PART_PICKER_HEADER, CREATE_EXERCISE_BUTTON_TEXT,
    CREATE_EXERCISE_EXERCISE_TYPE_PICKER_HEADER, CREATE_EXERCISE_NAME_ERROR,
    CREATE_EXERCISE_NAME_HEADER,
    CREATE_EXERCISE_NAME_PLACEHOLDER_TEXT, TOAST_ALREADY_EXISTS, TOAST_EXERCISE_CREATED,
} from '../constants/Strings';
import { addExercise } from '../store/exercises/ExercisesActions';
import { ExerciseMap } from '../store/exercises/ExercisesState';
import {
    createExercise,
    createExerciseName,
    ExerciseBodyPartEnum,
    ExerciseTypeEnum,
} from '../data/models/Exercise';
import LocalStore from '../store/LocalStore';
import { Text, useStyleTheme } from '../styles/Theme';

const CreateExerciseScreen = ({ navigation, route }: any) => {
    const exerciseMap = useSelector<LocalStore, ExerciseMap>((state: LocalStore) => state.exercises.map);

    const maxPickerWidth = Dimensions.get('window').width - (Spacing.MEDIUM * 2);
    const maxNameLength = 30;

    const [exerciseNameText, setExerciseNameText] = useState(route.params?.exerciseName.substring(0, maxNameLength) ?? '');
    const [showExerciseNameError, setShowExerciseNameError] = useState(false);

    const [exerciseType, setExerciseType] = useState<ExerciseTypeEnum>(ExerciseTypeEnum.BARBELL);
    const exerciseTypeValues: PickerItem[] = [
        { label: ExerciseTypeEnum.BARBELL, value: ExerciseTypeEnum.BARBELL },
        { label: ExerciseTypeEnum.DUMBBELL, value: ExerciseTypeEnum.DUMBBELL },
        { label: ExerciseTypeEnum.BODYWEIGHT, value: ExerciseTypeEnum.BODYWEIGHT },
        { label: ExerciseTypeEnum.CABLE, value: ExerciseTypeEnum.CABLE },
        { label: ExerciseTypeEnum.MACHINE, value: ExerciseTypeEnum.MACHINE },
        { label: ExerciseTypeEnum.WEIGHTED, value: ExerciseTypeEnum.WEIGHTED },
        { label: ExerciseTypeEnum.KETTLEBELL, value: ExerciseTypeEnum.KETTLEBELL },
        { label: ExerciseTypeEnum.TIMED, value: ExerciseTypeEnum.TIMED },
        { label: ExerciseTypeEnum.OTHER, value: ExerciseTypeEnum.OTHER },
    ];

    const [bodyPart, setBodyPart] = useState<ExerciseBodyPartEnum>(ExerciseBodyPartEnum.CHEST);
    const bodyPartValues: PickerItem[] = [
        { label: ExerciseBodyPartEnum.CHEST, value: ExerciseBodyPartEnum.CHEST },
        { label: ExerciseBodyPartEnum.BACK, value: ExerciseBodyPartEnum.BACK },
        { label: ExerciseBodyPartEnum.SHOULDERS, value: ExerciseBodyPartEnum.SHOULDERS },
        { label: ExerciseBodyPartEnum.TRAPS, value: ExerciseBodyPartEnum.TRAPS },
        { label: ExerciseBodyPartEnum.TRICEPS, value: ExerciseBodyPartEnum.TRICEPS },
        { label: ExerciseBodyPartEnum.BICEPS, value: ExerciseBodyPartEnum.BICEPS },
        { label: ExerciseBodyPartEnum.CORE, value: ExerciseBodyPartEnum.CORE },
        { label: ExerciseBodyPartEnum.LEGS, value: ExerciseBodyPartEnum.LEGS },
        { label: ExerciseBodyPartEnum.CALVES, value: ExerciseBodyPartEnum.CALVES },
        { label: ExerciseBodyPartEnum.FULL_BODY, value: ExerciseBodyPartEnum.FULL_BODY },
        { label: ExerciseBodyPartEnum.CARDIO, value: ExerciseBodyPartEnum.CARDIO },
        { label: ExerciseBodyPartEnum.OTHER, value: ExerciseBodyPartEnum.OTHER },
    ];

    const dispatch = useDispatch();

    const onNameTextChanged = (text: string) => {
        setExerciseNameText(text);
        setShowExerciseNameError(false);
    };

    const onCreateExercisePressed = () => {
        if (exerciseNameText === '') {
            setShowExerciseNameError(true);
            return;
        }

        const exerciseName = createExerciseName(exerciseNameText, exerciseType);
        if (exerciseMap[exerciseName]) {
            showToast('error', `${exerciseName} ${TOAST_ALREADY_EXISTS}`);
        } else {
            const exercise = createExercise(exerciseName, exerciseType, bodyPart);
            dispatch(addExercise(exercise));
            showToast('success', TOAST_EXERCISE_CREATED, exerciseName);
            navigation.goBack();
        }
    };

    return (
        <>
            <Ionicons style={{ alignSelf: 'center' }} name="md-barbell" size={128} color={useStyleTheme().colors.secondary} />
            <View style={{ marginLeft: Spacing.MEDIUM, marginRight: Spacing.MEDIUM, marginBottom: Spacing.MEDIUM }}>
                <TextInputWithHeader
                    header={CREATE_EXERCISE_NAME_HEADER}
                    placeholder={CREATE_EXERCISE_NAME_PLACEHOLDER_TEXT}
                    maxLength={maxNameLength}
                    value={exerciseNameText}
                    showError={showExerciseNameError}
                    errorMessage={CREATE_EXERCISE_NAME_ERROR}
                    onChangeText={onNameTextChanged}
                />
            </View>
            <View style={{
                marginLeft: Spacing.MEDIUM,
                marginRight: Spacing.MEDIUM,
                marginBottom: Spacing.MEDIUM,
                flexDirection: 'row',
                justifyContent: 'space-between',
            }}
            >
                <View style={{ width: maxPickerWidth * 0.47, paddingRight: Spacing.X_SMALL }}>
                    <Text style={{ fontWeight: 'bold', marginTop: Spacing.SMALL, marginBottom: Spacing.SMALL }}>
                        {CREATE_EXERCISE_EXERCISE_TYPE_PICKER_HEADER}
                    </Text>
                    <Picker
                        initialValue={exerciseType}
                        items={exerciseTypeValues}
                        width={(maxPickerWidth * 0.47) - Spacing.X_SMALL}
                        onValueSet={setExerciseType}
                    />
                </View>
                <View style={{ width: maxPickerWidth * 0.47, paddingRight: Spacing.X_SMALL }}>
                    <Text style={{ fontWeight: 'bold', marginTop: Spacing.SMALL, marginBottom: Spacing.SMALL }}>
                        {CREATE_EXERCISE_BODY_PART_PICKER_HEADER}
                    </Text>
                    <Picker
                        initialValue={bodyPart}
                        items={bodyPartValues}
                        width={(maxPickerWidth * 0.47) - Spacing.X_SMALL}
                        onValueSet={setBodyPart}
                    />
                </View>
            </View>
            <PrimaryButton
                style={{ margin: Spacing.MEDIUM }}
                label={CREATE_EXERCISE_BUTTON_TEXT}
                onPress={onCreateExercisePressed}
            />
        </>
    );
};

export default CreateExerciseScreen;
