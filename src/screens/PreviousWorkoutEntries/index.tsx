import React from 'react'

import {FlatList, ListRenderItemInfo} from 'react-native'

import {WorkoutSummary} from '@data/models/WorkoutSummary'
import {FontAwesome5, MaterialCommunityIcons} from '@expo/vector-icons'
import useWorkoutSummariesStore from '@store/workoutSummaries/useWorkoutSummariesStore'
import {Screen, useStyleTheme} from '@theme/Theme'

import Chip from '@components/Chip'
import LoadingOverlay from '@components/LoadingOverlay'
import PreviousEntryListItem, {EmptyState} from '@components/PreviousEntryListItem'

import Spacing from '@constants/Spacing'
import {
  BEST_SET_LABEL,
  EXERCISE_LABEL,
  LBS_LABEL,
  PREVIOUS_WORKOUTS_ENTRIES_EMPTY_BODY,
  PREVIOUS_WORKOUTS_ENTRIES_EMPTY_TITLE,
  SETS_LABEL
} from '@constants/Strings'

import BestSetChip from './components/BestSetChip'
import styles from './index.styled'
import {formatDateUTC} from '../../utility/DateUtility'

const PreviousWorkoutEntries = () => {
  const {isFetching, summaries, fetchSummaries} = useWorkoutSummariesStore()

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={
          <MaterialCommunityIcons
            style={styles.icon}
            name="weight-lifter"
            size={230}
            color={useStyleTheme().colors.secondary}
          />
        }
        title={PREVIOUS_WORKOUTS_ENTRIES_EMPTY_TITLE}
        body={PREVIOUS_WORKOUTS_ENTRIES_EMPTY_BODY}
      />
    )
  }

  const renderItem = ({item}: ListRenderItemInfo<WorkoutSummary>) => (
    <PreviousEntryListItem
      column1Label={EXERCISE_LABEL}
      column2Label={BEST_SET_LABEL}
      subItems={item.exercises}
      day={formatDateUTC(item.day)}
      headerChip={
        <Chip
          style={styles.chipContainer}
          label={`${item.totalWeight} ${LBS_LABEL}`}
          icon={
            <FontAwesome5
              name="weight-hanging"
              size={14}
              color={useStyleTheme().colors.secondaryLighter}
              style={{
                marginRight: Spacing.XX_SMALL
              }}
            />
          }
        />
      }
      getChipForItem={entry => <BestSetChip weight={entry?.bestSet?.weight} reps={entry?.bestSet?.reps} />}
      getTitleForItem={entry => entry.exercise.name}
      getSubtitleForItem={entry => `${entry.setsCompleted.toString()} ${SETS_LABEL}`}
    />
  )

  return (
    <>
      {isFetching && <LoadingOverlay />}

      <Screen>
        <FlatList
          style={styles.list}
          showsVerticalScrollIndicator={false}
          data={summaries}
          renderItem={renderItem}
          onEndReached={fetchSummaries}
        />
      </Screen>
    </>
  )
}

export default PreviousWorkoutEntries
