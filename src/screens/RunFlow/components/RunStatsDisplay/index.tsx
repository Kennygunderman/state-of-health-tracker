import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons'

import { Text, useStyleTheme } from '@theme/Theme'
import { RunSession } from '@store/runFlow/useRunFlowStore'
import useRunFlowStore from '@store/runFlow/useRunFlowStore'

import styles from './index.styled'

interface RunStatsDisplayProps {
  session: RunSession | null
  isTracking: boolean
}

const RunStatsDisplay: React.FC<RunStatsDisplayProps> = ({ session, isTracking }) => {
  const theme = useStyleTheme()
  const { updateStats } = useRunFlowStore()
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  useEffect(() => {
    if (!session || !session.isActive) return

    const interval = setInterval(() => {
      setCurrentTime(Date.now())
      updateStats() // Update stats every second to keep timer current
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [session?.isActive, updateStats])

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
    if (pace === 0 || !isFinite(pace)) return "--'--\""
    
    const minutes = Math.floor(pace)
    const seconds = Math.floor((pace - minutes) * 60)
    return `${minutes}'${seconds.toString().padStart(2, '0')}"`
  }

  const formatSpeed = (speed: number): string => {
    return speed.toFixed(1)
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.readyContainer}>
          <MaterialCommunityIcons 
            name="run" 
            size={120} 
            color={theme.colors.secondary}
            style={styles.readyIcon}
          />
          <Text style={styles.readyText}>Ready to Run!</Text>
          <Text style={styles.readySubtext}>Tap "Start Run" to begin tracking your workout</Text>
        </View>
      </View>
    )
  }

  const currentRunTime = session.stats.totalTime

  return (
    <View style={styles.container}>
      {/* Main Stats */}
      <View style={styles.mainStatsContainer}>
        <View style={styles.primaryStatContainer}>
          <Text style={styles.primaryStatLabel}>TIME</Text>
          <Text style={styles.primaryStatValue}>
            {formatTime(currentRunTime)}
          </Text>
        </View>

        <View style={styles.primaryStatContainer}>
          <Text style={styles.primaryStatLabel}>DISTANCE</Text>
          <Text style={styles.primaryStatValue}>
            {formatDistance(session.stats.totalDistance)}
          </Text>
          <Text style={styles.primaryStatUnit}>mi</Text>
        </View>
      </View>

      {/* Secondary Stats */}
      <View style={styles.secondaryStatsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Ionicons 
              name="speedometer-outline" 
              size={24} 
              color={theme.colors.white}
              style={styles.statIcon}
            />
            <Text style={styles.statLabel}>Current Pace</Text>
            <Text style={styles.statValue}>
              {formatPace(session.stats.currentPace)}
            </Text>
          </View>

          <View style={styles.statItem}>
            <MaterialCommunityIcons 
              name="chart-line" 
              size={24} 
              color={theme.colors.white}
              style={styles.statIcon}
            />
            <Text style={styles.statLabel}>Avg Pace</Text>
            <Text style={styles.statValue}>
              {formatPace(session.stats.averagePace)}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons 
              name="speedometer" 
              size={24} 
              color={theme.colors.white}
              style={styles.statIcon}
            />
            <Text style={styles.statLabel}>Speed</Text>
            <Text style={styles.statValue}>
              {formatSpeed(session.stats.currentSpeed)} mph
            </Text>
          </View>

          <View style={styles.statItem}>
            <MaterialCommunityIcons 
              name="fire" 
              size={24} 
              color={theme.colors.white}
              style={styles.statIcon}
            />
            <Text style={styles.statLabel}>Calories</Text>
            <Text style={styles.statValue}>
              {session.stats.calories || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusIndicator, 
          { 
            backgroundColor: isTracking 
              ? theme.colors.success 
              : session.isPaused 
                ? theme.colors.warning 
                : theme.colors.secondary 
          }
        ]} />
        <Text style={styles.statusText}>
          {isTracking ? 'Recording...' : session.isPaused ? 'Paused' : 'Stopped'}
        </Text>
      </View>
    </View>
  )
}

export default RunStatsDisplay
