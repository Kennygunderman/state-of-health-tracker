import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {entryCalories, entryProvenanceLabel, entryServingText, MealEntry} from '@data/models/MealEntry'
import {Opacity} from '@styles/sizes'
import {Swipeable} from 'react-native-gesture-handler'

import SwipeDeleteListItem from '@components/SwipeDeleteListItem'
import Text from '@components/Text'

import {CAL_LABEL} from '@constants/strings'

import styles from './index.styled'

interface Props {
  entry: MealEntry
  onPress?: () => void
  onDeletePressed: () => void
  swipeableRef: (ref: Swipeable) => void
  onSwipeActivated: () => void
}

const MealEntryRow = ({entry, onPress, onDeletePressed, swipeableRef, onSwipeActivated}: Props): React.JSX.Element => {
  const servingLabel = entryServingText(entry)
  const provenanceLabel = entryProvenanceLabel(entry)

  return (
    <SwipeDeleteListItem
      swipeableRef={swipeableRef}
      onSwipeActivated={onSwipeActivated}
      onDeletePressed={onDeletePressed}>
      <TouchableOpacity style={styles.row} activeOpacity={Opacity.PRESSED} disabled={!onPress} onPress={onPress}>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>
            {entry.name}

            {!!servingLabel && <Text style={styles.servingText}>{` · ${servingLabel}`}</Text>}
          </Text>

          {!!provenanceLabel && <Text style={styles.provenanceCaption}>{provenanceLabel}</Text>}
        </View>

        <View style={styles.caloriesContainer}>
          <Text style={styles.calories}>{entryCalories(entry)}</Text>

          <Text style={styles.caloriesLabel}>{CAL_LABEL}</Text>
        </View>
      </TouchableOpacity>
    </SwipeDeleteListItem>
  )
}

export default MealEntryRow
