import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
    KeyboardAvoidingView,
    SafeAreaView,
    SectionList,
    SectionListRenderItem,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ExerciseSectionListHeader from './components/ExerciseSectionListHeader';
import ExerciseSetListItem from './components/ExerciseSetListItem';
import WeeklyWorkoutsGraphModule from './components/WeeklyWorkoutsGraphModule';
import { EmptyState } from '../../components/PreviousEntryListItem';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { SectionListFooter } from '../../components/SectionListHeader';
import FontSize from '../../constants/FontSize';
import Screens from '../../constants/Screens';
import Spacing from '../../constants/Spacing';
import {
    ADD_EXERCISE_BUTTON_TEXT,
    DAILY_WORKOUT_TITLE,
    EMPTY_DAILY_WORKOUT_BODY,
    EMPTY_DAILY_WORKOUT_TITLE,
    VIEW_PREVIOUS_WORKOUTS_BUTTON_TEXT,
    YOUR_EXERCISES_HEADER,
} from '../../constants/Strings';
import { getExercisesForDaySelector } from '../../selectors/ExercisesSelector';
import { deleteSet } from '../../store/dailyExerciseEntries/DailyExerciseActions';
import { DailyExercise } from '../../store/dailyExerciseEntries/models/DailyExercise';
import { ExerciseSet } from '../../store/exercises/models/ExerciseSet';
import LocalStore from '../../store/LocalStore';
import Unique from '../../store/models/Unique';
import { Text, useStyleTheme } from '../../styles/Theme';
import { formatDayMonthDay } from '../../utility/DateUtility';
import ListSwipeItemManager from '../../utility/ListSwipeItemManager';

interface Section extends Unique {
    dailyExercise: DailyExercise;
    data: ExerciseSet[];
}

const listSwipeItemManager = new ListSwipeItemManager();

const WorkoutsScreen = ({ navigation }: any) => {
    const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);
    const dailyExercises = useSelector<LocalStore, DailyExercise[]>((state: LocalStore) => getExercisesForDaySelector(state));

    const sections: Section[] = dailyExercises.map((dailyExercise) => ({
        id: dailyExercise.id,
        dailyExercise,
        data: dailyExercise.sets,
    }));

    const dispatch = useDispatch();

    listSwipeItemManager.setRows(dailyExercises);

    const renderHeader = () => (
        <>
            <Text style={{
                fontWeight: 'bold',
                marginTop: Spacing.MEDIUM,
                marginLeft: Spacing.LARGE,
                marginBottom: Spacing.SMALL,
            }}
            >
                {formatDayMonthDay(currentDate)}
            </Text>
            <Text style={{
                fontSize: FontSize.H1,
                fontWeight: 'bold',
                margin: Spacing.MEDIUM,
                marginLeft: Spacing.LARGE,
            }}
            >
                {DAILY_WORKOUT_TITLE}
            </Text>
            <WeeklyWorkoutsGraphModule />
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                alignContent: 'center',
                margin: Spacing.MEDIUM,
            }}
            >
                <Text style={{
                    marginLeft: Spacing.X_SMALL,
                    fontSize: FontSize.H1,
                    fontWeight: 'bold',
                }}
                >
                    {YOUR_EXERCISES_HEADER}
                </Text>
                <SecondaryButton
                    style={{ alignSelf: 'flex-end' }}
                    label={ADD_EXERCISE_BUTTON_TEXT}
                    onPress={() => {
                        navigation.push(Screens.ADD_EXERCISE);
                    }}
                />
            </View>
            {dailyExercises.length === 0
                    && (
                        <EmptyState
                            icon={(
                                <Ionicons
                                    style={{ alignSelf: 'center', marginRight: -Spacing.MEDIUM, marginTop: Spacing.MEDIUM }}
                                    name="barbell"
                                    size={200}
                                    color={useStyleTheme().colors.secondary}
                                />
                            )}
                            title={EMPTY_DAILY_WORKOUT_TITLE}
                            body={EMPTY_DAILY_WORKOUT_BODY}
                        />
                    )}
        </>
    );

    const renderFooter = () => (
        <PrimaryButton
            style={{
                marginTop: Spacing.SMALL,
                marginBottom: Spacing.LARGE,
                marginLeft: Spacing.MEDIUM,
                marginRight: Spacing.MEDIUM,
            }}
            label={VIEW_PREVIOUS_WORKOUTS_BUTTON_TEXT}
            onPress={() => {
                navigation.push(Screens.PREVIOUS_DAILY_EXERCISE_ENTRIES);
            }}
        />
    );

    const renderSectionItemHeader = (dailyExercise: DailyExercise) => (
        <ExerciseSectionListHeader
            dailyExercise={dailyExercise}
            currentDate={currentDate}
            dailyExercisesToReorg={dailyExercises}
        />
    );

    const renderEmptySetState = () => (
        <SectionListFooter>
            <View />
        </SectionListFooter>
    );

    const renderSectionItemFooter = (dailyExercise: DailyExercise) => {
        if (dailyExercise.sets.length === 0) {
            return renderEmptySetState();
        }
        return (
            <SectionListFooter />
        );
    };

    const renderItem: SectionListRenderItem<ExerciseSet, Section> = ({ item, section, index }) => (
        <ExerciseSetListItem
            exercise={section.dailyExercise.exercise}
            set={item}
            index={index}
            onDeletePressed={() => {
                dispatch(deleteSet(currentDate, section.dailyExercise.exercise, item.id));
            }}
            swipeableRef={(ref) => {
                listSwipeItemManager.setRef(ref, section, index);
            }}
            onSwipeActivated={() => {
                listSwipeItemManager.closeRow(section, index);
            }}
        />
    );

    return (
        <SafeAreaView>
            <KeyboardAvoidingView behavior="padding">
                <SectionList
                    windowSize={3}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="always"
                    keyboardDismissMode="interactive"
                    style={{ width: '100%', height: '100%' }}
                    stickySectionHeadersEnabled={false}
                    sections={sections}
                    ListHeaderComponent={renderHeader()}
                    ListFooterComponent={renderFooter()}
                    renderItem={renderItem}
                    renderSectionHeader={({ section }) => renderSectionItemHeader(section.dailyExercise)}
                    renderSectionFooter={({ section }) => renderSectionItemFooter(section.dailyExercise)}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default WorkoutsScreen;
