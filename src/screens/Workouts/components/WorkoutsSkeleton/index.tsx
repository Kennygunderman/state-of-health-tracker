import React from 'react'

import {Dimensions, SafeAreaView, View} from 'react-native'

import {useSessionStore} from '@store/session/useSessionStore'
import {Text, useStyleTheme} from '@theme/Theme'

import Skeleton from '@components/Skeleton'

import BorderRadius from '@constants/BorderRadius'
import Spacing from '@constants/Spacing'
import {DAILY_WORKOUT_TITLE} from '@constants/Strings'

import styles from './index.styled'
import {formatDayMonthDay} from '../../../../utility/DateUtility'

const exerciseSetWidth = Dimensions.get('window').width - 50

const WorkoutsSkeleton = () => {
  const theme = useStyleTheme()

  const fakeXAxis = () => (
    <View style={styles.xAxisContainer}>
      {[2, 4, 2, 2, 1, 3, 2].map((barCount, i) => (
        <View key={i} style={styles.barContainer}>
          {Array.from({length: barCount}).map((_, j) => (
            <Skeleton key={j} height={25} width={25} borderRadius={4} style={{marginTop: 8}} />
          ))}
        </View>
      ))}
    </View>
  )

  const fakeYAxis = () => (
    <View style={styles.yAxisContainer}>
      {Array.from({length: 5}).map((_, i) => (
        <Skeleton key={i} height={15} width={15} borderRadius={4} style={{marginTop: 12}} />
      ))}
    </View>
  )

  return (
    <SafeAreaView>
      <Text style={styles.dateText}>{formatDayMonthDay(useSessionStore.getState().sessionStartDate)}</Text>

      <Text style={styles.workoutTitle}>{DAILY_WORKOUT_TITLE}</Text>

      <View
        style={[
          styles.graphContainer,
          {
            backgroundColor: theme.colors.tertiary,
            borderColor: theme.colors.secondary
          }
        ]}>
        <Skeleton height={15} width={150} borderRadius={6} style={{marginBottom: 12}} />

        <View style={styles.graphArea}>
          {fakeYAxis()}

          {fakeXAxis()}
        </View>
      </View>

      <View style={styles.contentContainer}>
        <View style={[styles.horizontalRowContainer, styles.topButtonContainers]}>
          <Skeleton height={30} width={150} />

          <Skeleton height={30} width={100} style={{borderRadius: BorderRadius.BUTTON}} />
        </View>
      </View>

      <View
        style={[
          styles.exerciseItemContainer,
          {
            borderColor: theme.colors.secondary
          }
        ]}>
        <View style={styles.contentContainer}>
          <View style={styles.horizontalRowContainer}>
            <Skeleton height={20} width={150} />

            <Skeleton height={30} width={75} style={{borderRadius: BorderRadius.BUTTON}} />
          </View>
        </View>

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <View style={{marginBottom: Spacing.MEDIUM}} />
      </View>

      <View
        style={[
          styles.exerciseItemContainer,
          {
            borderColor: theme.colors.secondary
          }
        ]}>
        <View style={styles.contentContainer}>
          <View style={styles.horizontalRowContainer}>
            <Skeleton height={20} width={150} />

            <Skeleton height={30} width={75} style={{borderRadius: BorderRadius.BUTTON}} />
          </View>
        </View>

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <Skeleton height={30} width={exerciseSetWidth} style={styles.exerciseSetContainer} />

        <View style={{marginBottom: Spacing.MEDIUM}} />
      </View>
    </SafeAreaView>
  )
}

export default WorkoutsSkeleton
