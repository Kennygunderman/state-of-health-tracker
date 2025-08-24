import React, {useEffect, useState} from 'react'
import {View, Text, SectionList, StyleSheet, Pressable, SafeAreaView} from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

import {useNavigation, useFocusEffect} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import LoadingOverlay from '@components/LoadingOverlay'
import SwipeDeleteListItem from '@components/SwipeDeleteListItem'
import ConfirmModal from '@components/dialog/ConfirmModal'
import {useStyleTheme} from '@theme/Theme'
import useRunFlowStore from '@store/runFlow/useRunFlowStore'
import runTrackingService from '@service/run/RunTrackingService'
import {useSessionStore} from '@store/session/useSessionStore'
import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import RunsBetaWarning from '@components/RunsBetaWarning'
import {RunsStackParamList} from '../../navigation/RunsStack'
import {RootStackParamList} from '../../navigation/types'
import {RunSession} from '@store/runFlow/useRunFlowStore'
import ListSwipeItemManager from '../../utility/ListSwipeItemManager'

type RunHistoryScreenNavigationProp = NativeStackNavigationProp<RunsStackParamList & RootStackParamList>

// Create swipe manager instance outside component to persist across renders
const listSwipeItemManager = new ListSwipeItemManager()

const RunHistoryScreen: React.FC = () => {
  const theme = useStyleTheme()
  const navigation = useNavigation<RunHistoryScreenNavigationProp>()

  const {
    startRun,
    startSimulation,
    runHistory: runs,
    isLoadingHistory: isLoadingRuns,
    loadRunHistory,
    deleteRun: deleteRunFromStore
  } = useRunFlowStore()

  const { hasSeenRunsBetaWarning, setHasSeenRunsBetaWarning } = useSessionStore()

  // State for delete confirmation modal
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [runToDelete, setRunToDelete] = useState<{id: string, name: string} | null>(null)

  // Group runs by date
  const groupRunsByDate = (runs: RunSession[]) => {
    const grouped = runs.reduce((acc, run) => {
      const date = new Date(run.startTime || Date.now()).toLocaleDateString()
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(run)
      return acc
    }, {} as Record<string, RunSession[]>)

    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
      .map(([date, runs]) => ({
        title: date,
        data: runs
      }))
  }

  const sections = groupRunsByDate(runs)

  // Update swipe manager with current runs
  listSwipeItemManager.setRows(runs.map(run => ({ id: run.id || '' })))

  // Load run history when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadRunHistory()
    }, [loadRunHistory])
  )

  // Show beta warning on first visit - separate effect to avoid showing on every focus
  useEffect(() => {
    if (!hasSeenRunsBetaWarning) {
      console.log('Showing beta warning for first time this session')
      // Small delay to ensure screen is fully loaded
      const timer = setTimeout(() => {
        openGlobalBottomSheet(
          <RunsBetaWarning
            onUnderstood={() => {
              console.log('User acknowledged beta warning')
              setHasSeenRunsBetaWarning(true)
            }}
          />,
          ['55%'] // Taller snap point for beta warning content with punctuation
        )
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [hasSeenRunsBetaWarning, setHasSeenRunsBetaWarning])

  const handleStartRun = async () => {
    // Navigate to RunFlowModal (modal presentation)
    navigation.navigate('RunFlowModal')
  }

  const handleSimulateRun = () => {
    startSimulation()
    navigation.navigate('RunFlowModal')
  }

  const handleRunPress = (runId: string) => {
    navigation.navigate('RunSummary', { runId })
  }

  const handleDeleteRun = (runId: string, runName: string) => {
    setRunToDelete({ id: runId, name: runName })
    setIsDeleteModalVisible(true)
  }

  const handleDeleteConfirmed = () => {
    if (runToDelete) {
      deleteRunFromStore(runToDelete.id)
    }
    setIsDeleteModalVisible(false)
    setRunToDelete(null)
  }

  const handleDeleteCancelled = () => {
    setIsDeleteModalVisible(false)
    setRunToDelete(null)
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

  if (isLoadingRuns && runs.length === 0) {
    return <LoadingOverlay />
  }

  const renderHeader = () => (
    <Text style={[styles.title, {color: theme.colors.white}]}>Runs</Text>
  )

  const renderSectionHeader = ({section}: {section: {title: string}}) => (
    <View style={[styles.sectionHeaderContainer, {backgroundColor: theme.colors.background}]}>
      <Text style={[styles.sectionHeader, {color: theme.colors.white}]}>{section.title}</Text>
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {runs.length === 0 ? (
        <View style={{flex: 1}}>
          {renderHeader()}
          {renderEmptyState()}
          <View style={styles.bottomButtonContainer}>
            <PrimaryButton
              label={'Start New Run'}
              onPress={handleStartRun}
            />
            {/* {__DEV__ && (
              <View style={{marginTop: 10}}>
                <SecondaryButton
                  label="Simulate Run (Dev)"
                  onPress={handleSimulateRun}
                />
              </View>
            )} */}
          </View>
        </View>
      ) : (
        <View style={{flex: 1}}>
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => item?.id || `run-${index}`}
            renderItem={renderRunItem}
            renderSectionHeader={renderSectionHeader}
            showsVerticalScrollIndicator={true}
            ListHeaderComponent={renderHeader()}
            contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 36}}
          />
          {/* Fade gradient to indicate more content */}
          <LinearGradient
            colors={['rgba(27, 29, 44, 0)', theme.colors.background]}
            style={styles.fadeGradient}
            pointerEvents="none"
          />
          <View style={styles.bottomButtonContainer}>
            <PrimaryButton
              label={'Start New Run'}
              onPress={handleStartRun}
            />
            {/* {__DEV__ && (
              <View style={{marginTop: 10}}>
                <SecondaryButton
                  label="Simulate Run (Dev)"
                  onPress={handleSimulateRun}
                />
              </View>
            )} */}
          </View>
        </View>
      )}

      <ConfirmModal
        confirmationTitle="Delete Run"
        confirmationBody={`Are you sure you want to delete this run? This action cannot be undone.`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        isVisible={isDeleteModalVisible}
        onConfirmPressed={handleDeleteConfirmed}
        onCancel={handleDeleteCancelled}
      />
    </SafeAreaView>
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
  bottomButtonContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 75, // Just above the button container for seamless transition
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    margin: 24,
    marginLeft: 0, // Offset the FlatList's paddingHorizontal (20px) to achieve 24px from screen edge
    marginTop: 24,
    marginBottom: 16, // 8px less than the default 24px margin
  },
  sectionHeader: {
    fontSize: FontSize.H3,
    fontWeight: '200',
    marginLeft: 0, // No margin from edge
    paddingTop: 12,
    paddingBottom: 12,
  }
})

export default RunHistoryScreen
