import React, { useEffect, useState } from 'react'
import { Alert, SafeAreaView, View, BackHandler, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons'

import { Text, useStyleTheme } from '@theme/Theme'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'

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

  const handleStopRun = async () => {
    Alert.alert(
      'Finish Run',
      'Are you sure you want to finish your run? This will save it to your run history.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Finish Run', 
          style: 'destructive',
          onPress: async () => {
            try {
              const completedSession = await stopRun()
              console.log('🏃‍♂️ Run completed and saved:', completedSession)
              
              // Navigate back
              goBack()
            } catch (error) {
              Alert.alert('Error', 'Failed to save run. Please try again.')
              console.error('❌ Failed to stop run:', error)
            }
          }
        }
      ]
    )
  }

  const handleCancelRun = () => {
    Alert.alert(
      'Cancel Run',
      'Are you sure you want to cancel your run? All data will be lost and not saved to your history.',
      [
        { text: 'Keep Running', style: 'cancel' },
        { 
          text: 'Cancel Run', 
          style: 'destructive',
          onPress: () => {
            cancelRun()
            console.log('🚫 Run cancelled')
            goBack()
          }
        }
      ]
    )
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
            onPress: handleCancelRun
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

    if (!currentSession) {
      return (
        <View style={controlsStyle}>
          <PrimaryButton
            label={isInitializing ? "Starting..." : "Start Run"}
            onPress={handleStartRun}
            disabled={isInitializing}
          />
          {__DEV__ && (
            <SecondaryButton
              label="Simulate Run (Dev)"
              onPress={startSimulation}
              style={{ marginTop: 10 }}
            />
          )}
        </View>
      )
    }

    // Only show Finish Run button at bottom during active run
    return (
      <View style={controlsStyle}>
        <PrimaryButton
          label="Finish Run"
          onPress={handleStopRun}
        />
      </View>
    )
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Run</Text>
      <Text style={styles.headerSubtitle}>
        {currentSession 
          ? currentSession.isPaused ? 'Paused' : 'Running...'
          : 'Ready to start'
        }
      </Text>
      
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
          onPress={handleCancelRun}
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
    </SafeAreaView>
  )
}

export default RunFlowScreen
