import React, { useState } from 'react';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { useSelector } from 'react-redux';
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
import { DailyExerciseEntry, getPreviousDailyExerciseEntriesSelector } from '../../selectors/ExercisesSelector';
import { ExerciseSet } from '../../store/exercises/models/ExerciseSet';
import LocalStore from '../../store/LocalStore';
import { Screen, useStyleTheme } from '../../styles/Theme';

const PreviousDailyExerciseEntriesScreen = () => {
    const loadBatchIncrement = 20;
    const [loadBatch, setLoadBatch] = useState(5);

    const entries = useSelector<LocalStore, DailyExerciseEntry[]>((state: LocalStore) => getPreviousDailyExerciseEntriesSelector(state, loadBatch));

    if (entries.length === 0) {
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

    const renderBestSetChip = (bestSet?: ExerciseSet) => (
        <BestSetChip set={bestSet} />
    );

    const renderItem = ({ item }: ListRenderItemInfo<DailyExerciseEntry>) => (
        <PreviousEntryListItem
            column1Label={EXERCISE_LABEL}
            column2Label={BEST_SET_LABEL}
            subItems={item.exercises}
            day={item.day}
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
            getChipForItem={(entry) => renderBestSetChip(entry.bestSet)}
            getTitleForItem={(entry) => entry.exercise.exercise.name}
            getSubtitleForItem={(entry) => `${entry.setsCompleted.toString()} ${SETS_LABEL}`}
        />
    );

    return (
        <Screen>
            <FlatList
                style={{ paddingTop: Spacing.MEDIUM, height: '100%' }}
                showsVerticalScrollIndicator={false}
                data={entries}
                renderItem={renderItem}
                onEndReached={() => setLoadBatch(loadBatchIncrement + loadBatch)}
            />
        </Screen>
    );
};

export default PreviousDailyExerciseEntriesScreen;
