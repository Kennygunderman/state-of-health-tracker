import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  SafeAreaView,
  SectionList,
  SectionListRenderItem,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import ExerciseSectionListHeader from './components/ExerciseSectionListHeader';
import ExerciseSetListItem from './components/ExerciseSetListItem';
import WeeklyWorkoutsGraphModule from './components/WeeklyWorkoutsGraphModule';
import { EmptyState } from '../../components/PreviousEntryListItem';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { SectionListFooter } from '../../components/SectionListHeader';
import {
  ADD_EXERCISE_BUTTON_TEXT,
  DAILY_WORKOUT_TITLE,
  EMPTY_DAILY_WORKOUT_BODY,
  EMPTY_DAILY_WORKOUT_TITLE,
  VIEW_PREVIOUS_WORKOUTS_BUTTON_TEXT,
  YOUR_EXERCISES_HEADER,
} from '../../constants/Strings';
import { DailyExercise } from '../../data/models/DailyExercise';
import { ExerciseSet } from '../../data/models/ExerciseSet';
import LocalStore from '../../store/LocalStore';
import Unique from '../../data/models/Unique';
import { Text, useStyleTheme } from '../../styles/Theme';
import { formatDayMonthDay } from '../../utility/DateUtility';
import ListSwipeItemManager from '../../utility/ListSwipeItemManager';
import useDailyWorkoutEntryStore from "../../store/dailyWorkoutEntry/useDailyWorkoutEntryStore";
import styles from './index.styled';
import Screens from "../../constants/Screens";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useNavigation } from "@react-navigation/native";
import { Navigation } from "../../navigation/types";
import useExercisesStore from "../../store/exercises/useExercisesStore";
import useWorkoutSummariesStore from "../../store/workoutSummaries/useWorkoutSummariesStore";
import useWeeklyWorkoutSummariesStore from "../../store/weeklyWorkoutSummaries/useWeeklyWorkoutSummariesStore";
import useExerciseTemplateStore from "../../store/exerciseTemplates/useExerciseTemplateStore";

interface Section extends Unique {
  dailyExercise: DailyExercise;
  data: ExerciseSet[];
}

const listSwipeItemManager = new ListSwipeItemManager();

const WorkoutsScreen = () => {

  const navigation = useNavigation<Navigation>()

  const currentDate = useSelector<LocalStore, string>((state: LocalStore) => state.userInfo.currentDate);

  const {
    initCurrentWorkoutDay,
    isInitializing,
    currentWorkoutDay,
    deleteSet
  } = useDailyWorkoutEntryStore();
  const { fetchExercises  } = useExercisesStore();
  const { fetchSummaries } = useWorkoutSummariesStore();
  const { fetchWeeklySummaries } = useWeeklyWorkoutSummariesStore();
  const { fetchTemplates } = useExerciseTemplateStore();

  useEffect(() => {
    initCurrentWorkoutDay();
    fetchExercises();
    fetchSummaries();
    fetchTemplates();
    fetchWeeklySummaries();
  }, []);

  const dailyExercises = currentWorkoutDay?.dailyExercises ?? [];
  const sections: Section[] = dailyExercises.map((dailyExercise) => ({
    id: dailyExercise.id,
    dailyExercise,
    data: dailyExercise.sets,
  }));

  listSwipeItemManager.setRows(dailyExercises);

  const renderExercisesSection = () => {
    return (
      <>
        <View style={styles.exerciseHeaderContainer}>
          <Text style={styles.exerciseHeaderText}>{YOUR_EXERCISES_HEADER}</Text>
          <SecondaryButton
            style={styles.addButton}
            label={ADD_EXERCISE_BUTTON_TEXT}
            onPress={() => navigation.push(Screens.ADD_EXERCISE)}
          />
        </View>
        {dailyExercises.length === 0 && (
          <EmptyState
            icon={(
              <Ionicons
                style={styles.emptyIcon}
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
    )
  }

  const renderHeader = () => (
    <>
      <Text style={styles.dateText}>{formatDayMonthDay(currentDate)}</Text>
      <Text style={styles.workoutTitle}>{DAILY_WORKOUT_TITLE}</Text>
      <WeeklyWorkoutsGraphModule/>
      {isInitializing ? <LoadingOverlay style={styles.loadingIndicator} /> : renderExercisesSection()}
    </>
  );

  const renderFooter = () => (
    <PrimaryButton
      style={styles.footerButton}
      label={VIEW_PREVIOUS_WORKOUTS_BUTTON_TEXT}
      onPress={() => navigation.push(Screens.PREVIOUS_DAILY_EXERCISE_ENTRIES)}
    />
  );

  const renderSectionItemHeader = (dailyExercise: DailyExercise) => (
    <ExerciseSectionListHeader
      dailyExercise={dailyExercise}
      dailyExercisesToReorg={dailyExercises}
    />
  );

  const renderEmptySetState = () => (
    <SectionListFooter>
      <View/>
    </SectionListFooter>
  );

  const renderSectionItemFooter = (dailyExercise: DailyExercise) => {
    if (dailyExercise.sets.length === 0) {
      return renderEmptySetState();
    }
    return <SectionListFooter/>;
  };

  const renderItem: SectionListRenderItem<ExerciseSet, Section> = ({
  item,
  section,
  index
}) => (
    <ExerciseSetListItem
      exercise={section.dailyExercise.exercise}
      set={item}
      index={index}
      onDeletePressed={() => deleteSet(section.dailyExercise.exercise, item.id)}
      swipeableRef={(ref) => listSwipeItemManager.setRef(ref, section, index)}
      onSwipeActivated={() => listSwipeItemManager.closeRow(section, index)}
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
          style={styles.sectionList}
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
