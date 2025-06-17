import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { TouchableOpacity, View } from 'react-native';
import BouncyCheckbox from 'react-native-bouncy-checkbox';
import { Swipeable } from 'react-native-gesture-handler';
import SwipeDeleteListItem from '../../../components/SwipeDeleteListItem';
import BorderRadius from '../../../constants/BorderRadius';
import Spacing from '../../../constants/Spacing';
import { LBS_LABEL, REPS_LABEL } from '../../../constants/Strings';
import { Exercise } from '../../../store/exercises/models/Exercise';
import { ExerciseSet } from '../../../store/exercises/models/ExerciseSet';
import { Text, TextInput, useStyleTheme } from '../../../styles/Theme';
import useDailyWorkoutEntryStore from "../../../store/dailyWorkoutEntry/useDailyWorkoutEntryStore";

interface Props {
    readonly exercise: Exercise;
    readonly set: ExerciseSet;
    readonly index: number;
    readonly swipeableRef: (ref: Swipeable) => void;
    readonly onSwipeActivated: () => void;
    readonly onDeletePressed: () => void;
}

const ExerciseSetListItem = (props: Props) => {
    const {
        exercise, set, index, swipeableRef, onSwipeActivated, onDeletePressed,
    } = props;


    const { completeSet } = useDailyWorkoutEntryStore()

    const [weightText, setWeightText] = useState(set.weight?.toString() ?? '');
    const [repsText, setRepsText] = useState(set.reps?.toString() ?? '');
    const [checkboxDisabled, setCheckboxDisabled] = useState(false);
    const [weightInputError, setWeightInputError] = useState(false);
    const [repsInputError, setRepsInputError] = useState(false);

    useEffect(() => {
        const latestWeight = exercise.latestCompletedSets[index]?.reps;
        const latestReps = exercise.latestCompletedSets[index]?.reps;

        if (weightText === '' || repsText === '') {
            if (latestWeight !== undefined && latestReps !== undefined) {
                setCheckboxDisabled(false);
            } else {
                setCheckboxDisabled(true);
            }
        } else {
            setCheckboxDisabled(false);
        }
    }, [weightText, repsText]);

    const completeSetChecked = (isChecked: boolean) => {
        let weight;
        if (weightText !== '') {
            weight = parseInt(weightText, 10);
        } else {
            weight = exercise.latestCompletedSets[index]?.weight;
            if (weight) {
                setWeightText(weight.toString());
            }
        }

        let reps;
        if (repsText !== '') {
            reps = parseInt(repsText, 10);
        } else {
            reps = exercise.latestCompletedSets[index]?.reps;
            if (reps) {
                setRepsText(reps.toString());
            }
        }

        setWeightInputError(weight === undefined);
        setRepsInputError(reps === undefined);

        if (weight === undefined || reps === undefined) {
            Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error,
            );
            return;
        }

        const updatedSet: ExerciseSet = {
            id: set.id,
            reps,
            weight,
            completed: isChecked,
        };

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Todo need to update the latest completed sets in the exercise state once i implement db functionality for this
        // dispatch(updateLatestCompletedSets(exercise, updatedSet, index));
        completeSet(exercise, set.id, isChecked, weight, reps);
    };

    const onWeightTextChanged = (text: string) => {
        setWeightInputError(false);
        setWeightText(text);
    };

    const onRepsTextChanged = (text: string) => {
        setRepsInputError(false);
        setRepsText(text);
    };

    return (
        <View key={set.id}>
            {index === 0
                && (
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-evenly',
                        paddingLeft: Spacing.X_LARGE,
                        paddingRight: Spacing.X_LARGE,
                    }}
                    >
                        <Text style={{ width: 80, textAlign: 'center', fontWeight: 'bold' }}>{LBS_LABEL}</Text>
                        <Text style={{ width: 80, textAlign: 'center', fontWeight: 'bold' }}>{REPS_LABEL}</Text>
                        <View style={{ width: 25, height: 25, backgroundColor: 'transparent' }} />
                    </View>
                )}
            <SwipeDeleteListItem
                deleteIconRightMargin={Spacing.MEDIUM}
                swipeableRef={swipeableRef}
                onSwipeActivated={onSwipeActivated}
                onDeletePressed={onDeletePressed}
            >
                <View style={{
                    backgroundColor: set.completed ? useStyleTheme().colors.secondaryLighter : useStyleTheme().colors.tertiary,
                    borderRadius: BorderRadius.SECTION,
                    marginBottom: Spacing.XX_SMALL,
                    paddingLeft: Spacing.SMALL,
                    paddingRight: Spacing.SMALL,
                    paddingTop: Spacing.XX_SMALL,
                    paddingBottom: Spacing.XX_SMALL,
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    marginLeft: Spacing.LARGE,
                    marginRight: Spacing.LARGE,
                }}
                >
                    <TextInput
                        selectTextOnFocus={true}
                        value={weightText}
                        onChangeText={onWeightTextChanged}
                        editable={!set.completed}
                        placeholder={exercise.latestCompletedSets[index]?.weight?.toString()}
                        returnKeyType="done"
                        contextMenuHidden={true}
                        textAlign="center"
                        maxLength={4}
                        style={{
                            opacity: set.completed ? 0.75 : 1,
                            width: 80,
                            height: 30,
                            padding: 0,
                            fontWeight: set.completed ? 'bold' : 'normal',
                            backgroundColor: weightInputError ? useStyleTheme().colors.errorLight : useStyleTheme().colors.primary,
                        }}
                        keyboardType="number-pad"
                    />
                    <TextInput
                        selectTextOnFocus={true}
                        value={repsText}
                        onChangeText={onRepsTextChanged}
                        editable={!set.completed}
                        placeholder={exercise.latestCompletedSets[index]?.reps?.toString()}
                        returnKeyType="done"
                        contextMenuHidden={true}
                        textAlign="center"
                        maxLength={4}
                        style={{
                            opacity: set.completed ? 0.75 : 1,
                            width: 80,
                            height: 30,
                            padding: 0,
                            fontWeight: set.completed ? 'bold' : 'normal',
                            backgroundColor: repsInputError ? useStyleTheme().colors.errorLight : useStyleTheme().colors.primary,
                        }}
                        keyboardType="number-pad"
                    />
                    <TouchableOpacity
                        style={{ width: 30, justifyContent: 'center' }}
                        onPress={() => completeSetChecked(false)}
                        disabled={!checkboxDisabled}
                    >
                        <BouncyCheckbox
                            disabled={checkboxDisabled}
                            isChecked={set.completed}
                            fillColor={set.completed ? useStyleTheme().colors.secondary : useStyleTheme().colors.secondaryLighter}
                            style={{ width: 25 }}
                            size={30}
                            onPress={completeSetChecked}
                        />
                    </TouchableOpacity>
                </View>
            </SwipeDeleteListItem>
            <View style={{
                position: 'absolute',
                width: 1,
                height: '100%',
                backgroundColor: useStyleTheme().colors.background,
                paddingRight: Spacing.MEDIUM,
                borderRightWidth: 1,
                borderRightColor: useStyleTheme().colors.border,
            }}
            />
            <View style={{
                position: 'absolute',
                alignSelf: 'flex-end',
                width: 1,
                height: '100%',
                paddingRight: Spacing.MEDIUM,
                backgroundColor: useStyleTheme().colors.background,
                borderLeftWidth: 1,
                borderLeftColor: useStyleTheme().colors.border,
            }}
            />
        </View>
    );
};

export default ExerciseSetListItem;
