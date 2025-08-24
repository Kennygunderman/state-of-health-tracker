import React, { useEffect, useState } from 'react'
import { Alert, SafeAreaView, View, BackHandler, TouchableOpacity, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons'

import { Text, useStyleTheme } from '@theme/Theme'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import ConfirmModal from '@components/dialog/ConfirmModal'
import { showToast } from '@components/toast/util/ShowToast'

import useRunFlowStore from '@store/runFlow/useRunFlowStore'
import { locationTrackingService } from '@service/location/LocationTrackingService'

import { Navigation } from '../../navigation/types'
import RunStatsDisplay from './components/RunStatsDisplay'
import RunMapView from './components/RunMapView'

import styles from './index.styled'

const RunFlowScreen = () => {
  const { goBack } = useNavigation<Navigation>()
  const theme = useStyleTheme()
  const insets = useSafeAreaInsets()
  
  const { 
    currentSession, 
    isTracking, 
    startRun, 
    pauseRun, 
    resumeRun, 
    stopRun,
    cancelRun,
    addLocationPoint,
    startSimulation
  } = useRunFlowStore()
  
  
  const [isInitializing, setIsInitializing] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [countdownValue, setCountdownValue] = useState(0) // 0 = no countdown, 3, 2, 1
  const [scaleAnim] = useState(new Animated.Value(0))
  const [fadeAnim] = useState(new Animated.Value(0))
  const [isCancelConfirmModalVisible, setIsCancelConfirmModalVisible] = useState(false)
  const [isFinishRunModalVisible, setIsFinishRunModalVisible] = useState(false)

  useEffect(() => {
    const backAction = () => {
      handleBackPress()
      return true // Prevent default back behavior
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction)
    return () => backHandler.remove()
  }, [currentSession])

  useEffect(() => {
    if (isTracking) {
      // Start location tracking when run is active
      locationTrackingService.startTracking((location) => {
        addLocationPoint(location)
      })
    } else {
      // Stop location tracking when paused or stopped
      locationTrackingService.stopTracking()
    }

    return () => {
      locationTrackingService.stopTracking()
    }
  }, [isTracking, addLocationPoint])


  // Auto-start countdown when modal opens and no session exists
  useEffect(() => {
    if (!currentSession && countdownValue === 0) {
      startCountdown()
    }
  }, [currentSession])


  // Countdown animation effect
  useEffect(() => {
    if (countdownValue > 0) {
      // Start animation
      scaleAnim.setValue(0)
      fadeAnim.setValue(0)
      
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After animation, wait then go to next number
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (countdownValue === 1) {
              // Start the run after countdown
              setCountdownValue(0)
              handleStartRun()
            } else {
              // Go to next number
              setCountdownValue(prev => prev - 1)
            }
          })
        }, 500)
      })
    }
  }, [countdownValue])

  const startCountdown = () => {
    setCountdownValue(3)
  }

  const handleStartRun = async () => {
    setIsInitializing(true)
    try {
      await startRun()
    } catch (error) {
      Alert.alert(
        'Location Permission Required',
        'This app needs location access to track your run. Please enable location services in your device settings.',
        [{ text: 'OK' }]
      )
      console.error('Failed to start run:', error)
    } finally {
      setIsInitializing(false)
    }
  }

  const handlePauseRun = () => {
    pauseRun()
  }

  const handleResumeRun = () => {
    resumeRun()
  }

  const handleStopRun = () => {
    // Check if distance is less than 0.05 miles before allowing completion
    if (currentSession) {
      const distanceInMiles = currentSession.stats.totalDistance || 0
      
      console.log('HandleStopRun - Distance check:', {
        distanceInMiles,
        routeLength: currentSession.route?.length || 0
      })
      
      if (distanceInMiles < 0.05) {
        // Show cancellation dialog for runs that are too short
        setIsCancelConfirmModalVisible(true)
        return
      }
    }
    
    // Normal completion flow for runs >= 0.05 miles
    setIsFinishRunModalVisible(true)
  }

  const handleFinishRunConfirmed = async () => {
    setIsFinishRunModalVisible(false)
    try {
      const completedSession = await stopRun()
      console.log('🏃‍♂️ Run completed and saved:', completedSession)
      
      // Show success toast
      showToast('success', 'Run Completed!', 'Your run has been saved to your history')
      
      // Navigate back
      goBack()
    } catch (error) {
      Alert.alert('Error', 'Failed to save run. Please try again.')
      console.error('❌ Failed to stop run:', error)
    }
  }

  const handleFinishRunCancelled = () => {
    setIsFinishRunModalVisible(false)
  }

  const handleCancelRunPressed = () => {
    setIsCancelConfirmModalVisible(true)
  }

  const handleCancelRunConfirmed = async () => {
    cancelRun()
    console.log('🚫 Run cancelled')
    
    setIsCancelConfirmModalVisible(false)
    goBack()
  }

  const handleCancelRunCancelled = () => {
    setIsCancelConfirmModalVisible(false)
  }

  const handleBackPress = () => {
    if (currentSession?.isActive) {
      Alert.alert(
        'Run in Progress',
        'You have an active run. What would you like to do?',
        [
          { text: 'Continue Running', style: 'cancel' },
          { 
            text: 'Pause & Exit', 
            onPress: () => {
              pauseRun()
              goBack()
            }
          },
          { 
            text: 'Finish Run', 
            onPress: handleStopRun
          },
          { 
            text: 'Cancel Run', 
            style: 'destructive',
            onPress: handleCancelRunPressed
          }
        ]
      )
    } else {
      goBack()
    }
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (miles: number): string => {
    return miles.toFixed(2)
  }

  const formatPace = (pace: number): string => {
    if (pace === 0 || !isFinite(pace)) return '--\'--"'
    
    const minutes = Math.floor(pace)
    const seconds = Math.floor((pace - minutes) * 60)
    return `${minutes}'${seconds.toString().padStart(2, '0')}"`
  }

  const renderControls = () => {
    const controlsStyle = [
      styles.controlsContainer,
      { paddingBottom: Math.max(insets.bottom + 20, 40) } // Ensure sufficient bottom padding
    ]

    // If there's a session, show the finish button
    if (currentSession) {
      return (
        <View style={controlsStyle}>
          <PrimaryButton
            label="Finish Run"
            onPress={handleStopRun}
          />
        </View>
      )
    }

    // If no session and countdown isn't running, show nothing (countdown will auto-start)
    return <View style={controlsStyle} />
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Run</Text>
      
      {/* Top left pause/play button */}
      {currentSession && (
        <TouchableOpacity 
          style={styles.topLeftButton}
          onPress={currentSession.isPaused ? handleResumeRun : handlePauseRun}
        >
          <Ionicons 
            name={currentSession.isPaused ? "play" : "pause"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
      )}
      
      {/* Top left cancel button (X) */}
      {currentSession && (
        <TouchableOpacity 
          style={styles.topLeftSecondButton}
          onPress={handleCancelRunPressed}
        >
          <Ionicons 
            name="close" 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
      )}
      
      {/* Top right map toggle button */}
      {currentSession && (
        <TouchableOpacity 
          style={styles.topRightButton}
          onPress={() => setShowMap(!showMap)}
        >
          <MaterialCommunityIcons 
            name={showMap ? "chart-line" : "map"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
      )}
    </View>
  )

  const renderCountdown = () => {
    if (countdownValue === 0) return null

    return (
      <View style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }
      ]}>
        <Animated.View style={{
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim
        }}>
          <Text style={{
            fontSize: 120,
            fontWeight: 'bold',
            color: theme.colors.white,
            textAlign: 'center'
          }}>
            {countdownValue}
          </Text>
        </Animated.View>
        <Text style={{
          fontSize: 18,
          color: theme.colors.white,
          marginTop: 20,
          textAlign: 'center'
        }}>
          Get ready to run!
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      <View style={styles.contentContainer}>
        {showMap && currentSession ? (
          <RunMapView 
            route={currentSession.route}
            style={styles.mapContainer}
          />
        ) : (
          <RunStatsDisplay 
            session={currentSession}
            isTracking={isTracking}
          />
        )}
        
      </View>

      {renderControls()}
      {renderCountdown()}
      
      <ConfirmModal
        confirmationTitle="Stop Run?"
        confirmationBody="Are you sure you want to stop your run? All data will be lost and not saved to your history."
        confirmButtonText="Stop Run"
        cancelButtonText="Continue"
        isVisible={isCancelConfirmModalVisible}
        onConfirmPressed={handleCancelRunConfirmed}
        onCancel={handleCancelRunCancelled}
      />
      
      <ConfirmModal
        confirmationTitle="Finish Run"
        confirmationBody="Are you sure you want to finish your run? This will save it to your run history."
        confirmButtonText="Finish Run"
        confirmButtonColor={theme.colors.success}
        cancelButtonText="Cancel"
        isVisible={isFinishRunModalVisible}
        onConfirmPressed={handleFinishRunConfirmed}
        onCancel={handleFinishRunCancelled}
      />
    </SafeAreaView>
  )
}

export default RunFlowScreen
