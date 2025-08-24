import React, {useEffect} from 'react'
import {View, Text, FlatList, Alert, StyleSheet, Pressable} from 'react-native'

import {useNavigation, useFocusEffect} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import LoadingOverlay from '@components/LoadingOverlay'
import SwipeDeleteListItem from '@components/SwipeDeleteListItem'
import {useStyleTheme} from '@theme/Theme'
import useRunFlowStore from '@store/runFlow/useRunFlowStore'
import runTrackingService from '@service/run/RunTrackingService'
import {RunsStackParamList} from '@navigation/RunsStack'
import {RunSession} from '@store/runFlow/useRunFlowStore'
import ListSwipeItemManager from '../../utility/ListSwipeItemManager'

type RunHistoryScreenNavigationProp = NativeStackNavigationProp<RunsStackParamList, 'RunHistory'>

// Create swipe manager instance outside component to persist across renders
const listSwipeItemManager = new ListSwipeItemManager()

const RunHistoryScreen: React.FC = () => {
  const theme = useStyleTheme()
  const navigation = useNavigation<RunHistoryScreenNavigationProp>()
  
  const {
    startRun,
    runHistory: runs,
    isLoadingHistory: isLoadingRuns,
    loadRunHistory,
    deleteRun: deleteRunFromStore
  } = useRunFlowStore()

  // Update swipe manager with current runs
  listSwipeItemManager.setRows(runs.map(run => ({ id: run.id || '' })))

  // Load run history when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadRunHistory()
    }, [loadRunHistory])
  )

  const handleStartRun = async () => {
    // Navigate to RunFlow screen where the actual run logic is handled
    navigation.navigate('RunFlow')
  }

  const handleRunPress = (runId: string) => {
    navigation.navigate('RunSummary', {runId})
  }

  const handleDeleteRun = (runId: string, runName: string) => {
    Alert.alert(
      'Delete Run',
      `Are you sure you want to delete "${runName}"? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRunFromStore(runId)
        }
      ]
    )
  }

  const renderRunItem = ({item, index}: {item: RunSession, index: number}) => {
    // Defensive checks to prevent crashes
    if (!item || !item.stats) {
      console.warn('Invalid run item:', item)
      return null
    }
    
    // Convert units for display with fallbacks
    const distanceInMeters = (item.stats.totalDistance || 0) * 1609.34 // Convert miles to meters
    
    // Format time directly from seconds (ensure positive)
    const totalSeconds = Math.abs(Math.floor(item.stats.totalTime || 0))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    // Add defensive checks for service calls with explicit string conversion
    let distance = '0.00'
    let pace = '0:00'
    
    try {
      const distanceResult = runTrackingService.formatDistance(distanceInMeters)
      distance = String(distanceResult || '0.00')
    } catch (error) {
      console.warn('Error formatting distance:', error)
      distance = '0.00'
    }
    
    try {
      const paceResult = runTrackingService.formatPace(item.stats.averagePace || 0)
      pace = String(paceResult || '0:00')
    } catch (error) {
      console.warn('Error formatting pace:', error)
      pace = '0:00'
    }
    
    const time = String(formattedTime || '00:00')
    const date = String(new Date(item.startTime || Date.now()).toLocaleDateString() || 'Unknown')
    const calories = String(item.stats.calories || 0)

    return (
      <SwipeDeleteListItem
        swipeableRef={ref => {
          listSwipeItemManager.setRef(ref, { id: item.id || '' }, index)
        }}
        onSwipeActivated={() => {
          listSwipeItemManager.closeRow({ id: item.id || '' }, index)
        }}
        onDeletePressed={() => {
          item.id && handleDeleteRun(item.id, 'Run')
        }}>
        <Pressable
          style={[styles.runItemContainer, {backgroundColor: theme.colors.primary, borderColor: theme.colors.border}]}
          onPress={() => item.id && handleRunPress(item.id)}>
          <View style={styles.runItemHeader}>
            <Text style={{color: theme.colors.white, fontSize: 16, fontWeight: 'bold'}}>
              {'Run'}
            </Text>
            <Text style={{color: theme.colors.grey, fontSize: 14}}>
              {date}
            </Text>
          </View>
          
          <View style={styles.runItemStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{distance}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Miles</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{time}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Time</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{pace}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Pace</Text>
            </View>
            
            {item.stats.calories && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, {color: theme.colors.white}]}>{calories}</Text>
                <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Cal</Text>
              </View>
            )}
          </View>
        </Pressable>
      </SwipeDeleteListItem>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Text style={{
        color: theme.colors.grey,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 16
      }}>
        No runs yet
      </Text>
      <Text style={{
        color: theme.colors.grey,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24
      }}>
        Start your first run to begin tracking your progress
      </Text>
    </View>
  )

  if (isLoadingRuns) {
    return <LoadingOverlay />
  }

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <View style={{padding: 20}}>
        <PrimaryButton
          label={'Start New Run'}
          onPress={handleStartRun}
        />
      </View>

      {runs.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item, index) => item?.id || `run-${index}`}
          renderItem={renderRunItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 20}}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  runItemContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  runItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  runItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
})

export default RunHistoryScreen
