import React, { useEffect, useState } from 'react';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, ListRenderItemInfo } from 'react-native';
import BestSetChip from './components/BestSetChip';
import Chip from '../../components/Chip';
import PreviousEntryListItem, { EmptyState } from '../../components/PreviousEntryListItem';
import Spacing from '../../constants/Spacing';
import {
    BEST_SET_LABEL,
    EXERCISE_LABEL,
    LBS_LABEL, PREVIOUS_WORKOUTS_ENTRIES_EMPTY_BODY, PREVIOUS_WORKOUTS_ENTRIES_EMPTY_TITLE,
    SETS_LABEL,
} from '../../constants/Strings';
import { Screen, useStyleTheme } from '../../styles/Theme';
import useWorkoutSummariesStore from "../../store/workoutSummaries/useWorkoutSummariesStore";
import { WorkoutSummary } from "../../data/models/WorkoutSummary";
import { formatDateUTC } from "../../utility/DateUtility";

const PreviousDailyExerciseEntriesScreen = () => {
    const loadBatchIncrement = 20;
    const [loadBatch, setLoadBatch] = useState(5);

  const { summaries } = useWorkoutSummariesStore();

    if (summaries.length === 0) {
        return (
            <EmptyState
                icon={(
                    <MaterialCommunityIcons
                        style={{ alignSelf: 'center', marginTop: Spacing.MEDIUM }}
                        name="weight-lifter"
                        size={230}
                        color={useStyleTheme().colors.secondary}
                    />
                )}
                title={PREVIOUS_WORKOUTS_ENTRIES_EMPTY_TITLE}
                body={PREVIOUS_WORKOUTS_ENTRIES_EMPTY_BODY}
            />
        );
    }


    const renderItem = ({ item }: ListRenderItemInfo<WorkoutSummary>) => (
        <PreviousEntryListItem
            column1Label={EXERCISE_LABEL}
            column2Label={BEST_SET_LABEL}
            subItems={item.exercises}
            day={formatDateUTC(item.day)}
            headerChip={(
                <Chip
                    label={`${item.totalWeight} ${LBS_LABEL}`}
                    icon={(
                        <FontAwesome5
                            name="weight-hanging"
                            size={14}
                            color={useStyleTheme().colors.secondaryLighter}
                            style={{
                                marginRight: Spacing.XX_SMALL,
                            }}
                        />
                    )}
                    style={{
                        paddingRight: Spacing.SMALL,
                        paddingLeft: Spacing.SMALL,
                        alignSelf: 'flex-start',
                    }}
                />
            )}
            getChipForItem={(entry) =>(<BestSetChip weight={entry?.bestSet?.weight} reps={entry?.bestSet?.reps} />)}
            getTitleForItem={(entry) => entry.exercise.name}
            getSubtitleForItem={(entry) => `${entry.setsCompleted.toString()} ${SETS_LABEL}`}
        />
    );

    return (
        <Screen>
            <FlatList
                style={{ paddingTop: Spacing.MEDIUM, height: '100%' }}
                showsVerticalScrollIndicator={false}
                data={summaries}
                renderItem={renderItem}
                onEndReached={() => setLoadBatch(loadBatchIncrement + loadBatch)}
            />
        </Screen>
    );
};

export default PreviousDailyExerciseEntriesScreen;
