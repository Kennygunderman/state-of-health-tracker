import React, {useEffect, useState} from 'react'
import {View, Text, Alert, StyleSheet} from 'react-native'

import {useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import {useStyleTheme} from '@theme/Theme'
import useRunStore from '@store/run/useRunStore'
import runTrackingService from '@service/run/RunTrackingService'
import {RunsStackParamList} from '@navigation/RunsStack'
import {RunStatus} from '@types/run'

type ActiveRunScreenNavigationProp = NativeStackNavigationProp<RunsStackParamList, 'ActiveRun'>

const ActiveRunScreen: React.FC = () => {
  const theme = useStyleTheme()
  const navigation = useNavigation<ActiveRunScreenNavigationProp>()
  
  const {
    currentSession,
    runStatus,
    pauseRun,
    resumeRun,
    stopRun,
    completeRun
  } = useRunStore()

  const [elapsedTime, setElapsedTime] = useState(0)

  // Update elapsed time every second
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (currentSession && runStatus === RunStatus.ACTIVE) {
      interval = setInterval(() => {
        const now = Date.now()
        const elapsed = now - currentSession.startTime
        setElapsedTime(elapsed)
      }, 1000)
    } else if (currentSession && runStatus === RunStatus.PAUSED) {
      // Keep the last elapsed time when paused
      const elapsed = currentSession.lastUpdate - currentSession.startTime
      setElapsedTime(elapsed)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentSession, runStatus])

  // Redirect if no active session
  useEffect(() => {
    if (!currentSession) {
      navigation.navigate('RunHistory')
    }
  }, [currentSession, navigation])

  if (!currentSession) {
    return null // Will redirect via useEffect
  }

  const handlePauseResume = () => {
    if (runStatus === RunStatus.ACTIVE) {
      pauseRun()
    } else if (runStatus === RunStatus.PAUSED) {
      resumeRun()
    }
  }

  const handleStop = () => {
    Alert.alert(
      'Stop Run',
      'Are you sure you want to stop your run? This will discard all progress.',
      [
        {text: 'Continue Running', style: 'cancel'},
        {
          text: 'Stop Run',
          style: 'destructive',
          onPress: async () => {
            await stopRun()
            navigation.navigate('RunHistory')
          }
        }
      ]
    )
  }

  const handleComplete = () => {
    Alert.alert(
      'Complete Run',
      'Save your run and view the summary?',
      [
        {text: 'Keep Running', style: 'cancel'},
        {
          text: 'Complete Run',
          onPress: async () => {
            const completedRun = await completeRun()
            if (completedRun) {
              navigation.navigate('RunSummary', {runId: completedRun.id})
            } else {
              Alert.alert('Error', 'Failed to save run. Please try again.')
            }
          }
        }
      ]
    )
  }

  const distance = runTrackingService.formatDistance(currentSession.currentDistance)
  const time = runTrackingService.formatTime(elapsedTime)
  const speed = runTrackingService.formatSpeed(currentSession.currentSpeed)

  const isPaused = runStatus === RunStatus.PAUSED
  const pauseButtonTitle = isPaused ? 'Resume' : 'Pause'

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={styles.statsContainer}>
        <View style={styles.mainStatsContainer}>
          <View style={{alignItems: 'center', flex: 1}}>
            <Text style={[styles.mainStatValue, {color: theme.colors.white}]}>{distance}</Text>
            <Text style={[styles.mainStatLabel, {color: theme.colors.grey}]}>Miles</Text>
          </View>
          
          <View style={{alignItems: 'center', flex: 1}}>
            <Text style={[styles.mainStatValue, {color: theme.colors.white}]}>{time}</Text>
            <Text style={[styles.mainStatLabel, {color: theme.colors.grey}]}>Time</Text>
          </View>
        </View>

        <View style={styles.secondaryStatsContainer}>
          <View style={styles.secondaryStatItem}>
            <Text style={[styles.secondaryStatValue, {color: theme.colors.white}]}>{speed}</Text>
            <Text style={[styles.secondaryStatLabel, {color: theme.colors.grey}]}>MPH</Text>
          </View>
          
          {/* Add more stats here if needed */}
        </View>

        {isPaused && (
          <Text style={[styles.statusText, {color: theme.colors.orange}]}>
            Run Paused
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <View style={{marginBottom: 12}}>
          <PrimaryButton
            label={pauseButtonTitle}
            onPress={handlePauseResume}
          />
        </View>
        
        <View style={{marginBottom: 12}}>
          <SecondaryButton
            label="Complete Run"
            onPress={handleComplete}
          />
        </View>
        
        <SecondaryButton
          label="Stop Run"
          onPress={handleStop}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },
  mainStatValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mainStatLabel: {
    fontSize: 18,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  secondaryStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  secondaryStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  secondaryStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  secondaryStatLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
})

export default ActiveRunScreen
