import React, {useEffect, useState} from 'react'
import {View, Text, StyleSheet} from 'react-native'

import {useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import ConfirmModal from '@components/dialog/ConfirmModal'
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
  const [isStopModalVisible, setIsStopModalVisible] = useState(false)
  const [isCompleteModalVisible, setIsCompleteModalVisible] = useState(false)
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false)

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
    setIsStopModalVisible(true)
  }

  const handleComplete = () => {
    // Calculate actual distance from coordinates to ensure accuracy
    const coordinates = currentSession?.coordinates || []
    const actualDistanceMeters = runTrackingService.calculateTotalDistance(coordinates)
    const distanceInMiles = actualDistanceMeters / 1609.34
    
    console.log('HandleComplete - Distance check:', {
      actualDistanceMeters,
      distanceInMiles,
      coordinatesCount: coordinates.length,
      sessionDistance: currentSession?.currentDistance || 0
    })
    
    if (distanceInMiles < 0.05) {
      // Show cancellation dialog for runs that are too short
      setIsCancelModalVisible(true)
      return
    }
    
    // Normal completion flow for runs >= 0.05 miles
    setIsCompleteModalVisible(true)
  }

  const handleStopConfirm = async () => {
    setIsStopModalVisible(false)
    await stopRun()
    navigation.navigate('RunHistory')
  }

  const handleCompleteConfirm = async () => {
    setIsCompleteModalVisible(false)
    const completedRun = await completeRun()
    if (completedRun) {
      navigation.navigate('RunSummary', {runId: completedRun.id})
    } else {
      // Run was cancelled due to being too short or other error - this shouldn't happen now
      setIsCancelModalVisible(true)
    }
  }

  const handleCancelConfirm = async () => {
    setIsCancelModalVisible(false)
    await stopRun()
    navigation.navigate('RunHistory')
  }

  const closeModals = () => {
    setIsStopModalVisible(false)
    setIsCompleteModalVisible(false)
    setIsCancelModalVisible(false)
  }

  const distance = runTrackingService.formatDistance(currentSession.currentDistance)
  const time = runTrackingService.formatTime(elapsedTime)
  const speed = runTrackingService.formatSpeed(currentSession.currentSpeed)

  const isPaused = runStatus === RunStatus.PAUSED
  const pauseButtonTitle = isPaused ? 'Resume' : 'Pause'

  return (
    <>
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

      {/* Stop Run Confirmation Modal */}
      <ConfirmModal
        confirmationTitle="Stop Run"
        confirmationBody="Are you sure you want to stop your run? This will discard all progress."
        confirmButtonText="Stop Run"
        confirmButtonColor={theme.colors.error}
        cancelButtonText="Continue Running"
        isVisible={isStopModalVisible}
        onConfirmPressed={handleStopConfirm}
        onCancel={closeModals}
      />

      {/* Complete Run Confirmation Modal */}
      <ConfirmModal
        confirmationTitle="Complete Run"
        confirmationBody="Save your run and view the summary?"
        confirmButtonText="Complete Run"
        confirmButtonColor={theme.colors.success}
        cancelButtonText="Keep Running"
        isVisible={isCompleteModalVisible}
        onConfirmPressed={handleCompleteConfirm}
        onCancel={closeModals}
      />

      {/* Cancel Run Modal (for runs < 0.05 miles) */}
      <ConfirmModal
        confirmationTitle="Cancel Run"
        confirmationBody="Your run is less than 0.05 miles. Runs this short cannot be saved. Would you like to cancel this run?"
        confirmButtonText="Cancel Run"
        confirmButtonColor={theme.colors.error}
        cancelButtonText="Keep Running"
        isVisible={isCancelModalVisible}
        onConfirmPressed={handleCancelConfirm}
        onCancel={closeModals}
      />
    </>
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
