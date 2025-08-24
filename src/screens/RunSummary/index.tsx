import React, {useEffect, useState} from 'react'
import {View, Text, ScrollView, Dimensions, StyleSheet} from 'react-native'
import MapView, {Polyline, PROVIDER_DEFAULT} from 'react-native-maps'

import {useNavigation, useRoute, RouteProp} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import PrimaryButton from '@components/PrimaryButton'
import LoadingOverlay from '@components/LoadingOverlay'
import {useStyleTheme} from '@theme/Theme'
import useRunFlowStore from '@store/runFlow/useRunFlowStore'
import runTrackingService from '@service/run/RunTrackingService'
import {RunsStackParamList} from '../../navigation/RunsStack'
import {RunSession} from '@store/runFlow/useRunFlowStore'
import {RunMapData} from '@types/run'

type RunSummaryScreenNavigationProp = NativeStackNavigationProp<RunsStackParamList, 'RunSummary'>
type RunSummaryScreenRouteProp = RouteProp<RunsStackParamList, 'RunSummary'>

const {width: screenWidth, height: screenHeight} = Dimensions.get('window')

const RunSummaryScreen: React.FC = () => {
  const theme = useStyleTheme()
  const navigation = useNavigation<RunSummaryScreenNavigationProp>()
  const route = useRoute<RunSummaryScreenRouteProp>()
  
  const {runId} = route.params
  const {runHistory: runs, loadRunHistory} = useRunFlowStore()
  
  const [runData, setRunData] = useState<RunSession | null>(null)
  const [mapData, setMapData] = useState<RunMapData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load run history first to ensure we have the latest data
    loadRunHistory()
  }, [])

  useEffect(() => {
    const run = runs.find(r => r.id === runId)
    if (run) {
      setRunData(run)
      
      // Generate map data for visualization
      if (run.route.length > 0) {
        // Convert RunSession route to GPSCoordinate format for map generation
        const coordinates = run.route.map(point => ({
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp,
          altitude: 0,
          accuracy: point.accuracy || 0,
          speed: point.speed || 0
        }))
        const mapVisualization = runTrackingService.generateMapData(coordinates)
        setMapData(mapVisualization)
      }
    }
    setLoading(false)
  }, [runId, runs])


  const handleBackToRuns = () => {
    navigation.navigate('RunHistory')
  }

  if (loading) {
    return <LoadingOverlay />
  }

  if (!runData) {
    return (
      <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{color: theme.colors.white, fontSize: 18}}>
            Run not found
          </Text>
          <View style={{marginTop: 20}}>
            <PrimaryButton
              label="Back to Runs"
              onPress={handleBackToRuns}
            />
          </View>
        </View>
      </View>
    )
  }

  // Format stats for display
  // Convert miles to meters for the formatting function
  const distanceInMeters = (runData.stats.totalDistance || 0) * 1609.34
  const distance = runTrackingService.formatDistance(distanceInMeters)
  const time = runTrackingService.formatTime((runData.stats.totalTime || 0) * 1000) // Convert seconds to milliseconds
  const avgPace = runTrackingService.formatPace(runData.stats.averagePace || 0)
  const avgSpeed = runTrackingService.formatSpeed((runData.stats.averageSpeed || 0) * 0.44704) // Convert mph to m/s
  const maxSpeed = runTrackingService.formatSpeed((runData.stats.currentSpeed || 0) * 0.44704) // Convert mph to m/s
  
  const date = new Date(runData.startTime).toLocaleDateString()
  const startTime = new Date(runData.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Create heatmap colors for the polyline
  const getHeatmapColors = (): string[] => {
    if (!mapData?.heatmapPoints || mapData.heatmapPoints.length === 0) {
      return ['#3366FF'] // Default blue
    }

    return mapData.heatmapPoints.map(point => {
      // Create color gradient from slow (blue) to fast (red)
      const intensity = point.intensity
      if (intensity < 0.33) {
        return '#3366FF' // Blue for slow
      } else if (intensity < 0.66) {
        return '#FFB366' // Orange for medium
      } else {
        return '#FF3366' // Red for fast
      }
    })
  }

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map Section */}
        {mapData && mapData.routeCoordinates.length > 1 && (
          <View style={styles.mapContainer}>
            <Text style={[styles.sectionTitle, {color: theme.colors.white}]}>Route</Text>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={{
                width: screenWidth - 40,
                height: 250,
                borderRadius: 12
              }}
              initialRegion={{
                latitude: (mapData.bounds.northeast.latitude + mapData.bounds.southwest.latitude) / 2,
                longitude: (mapData.bounds.northeast.longitude + mapData.bounds.southwest.longitude) / 2,
                latitudeDelta: Math.abs(mapData.bounds.northeast.latitude - mapData.bounds.southwest.latitude) * 1.2,
                longitudeDelta: Math.abs(mapData.bounds.northeast.longitude - mapData.bounds.southwest.longitude) * 1.2
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}>
              <Polyline
                coordinates={mapData.routeCoordinates}
                strokeWidth={4}
                strokeColor="#3366FF"
                lineCap="round"
                lineJoin="round"
              />
            </MapView>
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <Text style={[styles.sectionTitle, {color: theme.colors.white}]}>Stats</Text>
          
          <View style={{marginBottom: 16}}>
            <Text style={{color: theme.colors.white, fontSize: 18, fontWeight: 'bold'}}>
              Run {date}
            </Text>
            <Text style={{color: theme.colors.grey, fontSize: 14, marginTop: 4}}>
              Started at {startTime}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{distance}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Distance (mi)</Text>
            </View>
            
            <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{time}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Time</Text>
            </View>
            
            <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{avgPace}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Avg Pace</Text>
            </View>
            
            <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{avgSpeed}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Avg Speed (mph)</Text>
            </View>
            
            <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
              <Text style={[styles.statValue, {color: theme.colors.white}]}>{maxSpeed}</Text>
              <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Max Speed (mph)</Text>
            </View>
            
            {runData.stats.calories && (
              <View style={[styles.statItem, {backgroundColor: theme.colors.primaryBackground, borderColor: theme.colors.border}]}>
                <Text style={[styles.statValue, {color: theme.colors.white}]}>{runData.stats.calories}</Text>
                <Text style={[styles.statLabel, {color: theme.colors.grey}]}>Calories</Text>
              </View>
            )}
          </View>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    padding: 20,
    marginBottom: 10,
  },
  statsContainer: {
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 10,
  },
})

export default RunSummaryScreen
