import React from 'react';
import { FlatList, ListRenderItemInfo, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ExerciseTypeChip from './AddExercise/components/ExerciseTypeChip';
import ListItem from '../components/ListItem';
import PrimaryButton from '../components/PrimaryButton';
import { showToast } from '../components/toast/util/ShowToast';
import FontSize from '../constants/FontSize';
import Spacing from '../constants/Spacing';
import {
    stringWithParameters,
    TOAST_TEMPLATE_EXERCISES_ADDED,
    TOAST_TEMPLATE_EXERCISES_ADDED_BODY,
} from '../constants/Strings';
import { getExercisesForTemplateSelector, getExercisesSelector } from '../selectors/ExercisesSelector';
import { addDailyExercise } from '../store/dailyExerciseEntries/DailyExerciseActions';
import { Exercise } from '../store/exercises/models/Exercise';
import { WorkoutTemplate } from '../store/exercises/models/WorkoutTemplate';
import LocalStore from '../store/LocalStore';
import { Text, useStyleTheme } from '../styles/Theme';

export interface WorkoutTemplateDetailRouteParams {
    template: WorkoutTemplate
}

const WorkoutTemplateDetailScreen = ({ navigation, route }: any) => {
    const { template }: WorkoutTemplateDetailRouteParams = route.params;

    const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);
    const exercises = useSelector<LocalStore, Exercise[]>((state: LocalStore) => getExercisesForTemplateSelector(state, template));

    const dispatch = useDispatch();

    const addExerciseToDailyEntry = () => {
        exercises.forEach((exercise) => {
            dispatch(addDailyExercise(currentDate, exercise));
        });
    };

    const renderItem = ({ item }: ListRenderItemInfo<Exercise>) => (
        <ListItem
            isTappable={false}
            isSwipeable={false}
            leftRightMargin={Spacing.MEDIUM}
            title={item.name}
            subtitle={item.exerciseBodyPart}
            chip={<ExerciseTypeChip exerciseType={item.exerciseType} />}
        />
    );

    return (
        <FlatList
            stickyHeaderIndices={[0]}
            data={exercises}
            ListHeaderComponent={(
                <Text style={{
                    paddingLeft: Spacing.LARGE,
                    paddingVertical: Spacing.MEDIUM,
                    fontSize: FontSize.H1,
                    fontWeight: 'bold',
                    backgroundColor: useStyleTheme().colors.background,
                }}
                >
                    {template.name}
                </Text>
            )}
            ListFooterComponent={(
                <PrimaryButton
                    style={{ margin: Spacing.MEDIUM, marginBottom: Spacing.X_LARGE }}
                    label="Start Workout"
                    onPress={() => {
                        addExerciseToDailyEntry();
                        showToast('success', TOAST_TEMPLATE_EXERCISES_ADDED, stringWithParameters(TOAST_TEMPLATE_EXERCISES_ADDED_BODY, template.name));
                        navigation.pop(2);
                    }}
                />
            )}
            renderItem={renderItem}
        />
    );
};

export default WorkoutTemplateDetailScreen;
