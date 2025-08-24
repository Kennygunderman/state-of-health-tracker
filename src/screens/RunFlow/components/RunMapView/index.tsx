import React, { useMemo } from 'react'
import { View, ViewStyle } from 'react-native'
import MapView, { Polyline, PROVIDER_APPLE, Region } from 'react-native-maps'

import { Text, useStyleTheme } from '@theme/Theme'
import { LocationPoint } from '@store/runFlow/useRunFlowStore'

import styles from './index.styled'

interface RunMapViewProps {
  route: LocationPoint[]
  style?: ViewStyle
}

const RunMapView: React.FC<RunMapViewProps> = ({ route, style }) => {
  const theme = useStyleTheme()

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8 // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Calculate map region from route points
  const mapRegion: Region | undefined = useMemo(() => {
    if (route.length === 0) return undefined

    let minLat = route[0].latitude
    let maxLat = route[0].latitude
    let minLng = route[0].longitude
    let maxLng = route[0].longitude

    route.forEach(point => {
      minLat = Math.min(minLat, point.latitude)
      maxLat = Math.max(maxLat, point.latitude)
      minLng = Math.min(minLng, point.longitude)
      maxLng = Math.max(maxLng, point.longitude)
    })

    const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01) // Add 20% padding
    const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01)

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    }
  }, [route])

  // Generate route coordinates for polyline
  const routeCoordinates = useMemo(() => {
    return route.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }))
  }, [route])

  // Create speed-based polyline segments for heatmap effect
  const speedSegments = useMemo(() => {
    if (route.length < 2) return []

    const segments = []
    
    for (let i = 1; i < route.length; i++) {
      const prevPoint = route[i - 1]
      const currentPoint = route[i]
      
      // Calculate speed between points
      const distance = calculateDistance(
        prevPoint.latitude, prevPoint.longitude,
        currentPoint.latitude, currentPoint.longitude
      )
      const timeDiff = (currentPoint.timestamp - prevPoint.timestamp) / 1000 / 3600 // hours
      const speed = timeDiff > 0 ? distance / timeDiff : 0 // mph
      
      // Determine color based on speed
      let color = '#4CAF50' // Green for normal pace
      if (speed < 3) {
        color = '#FF5722' // Red for slow/walking
      } else if (speed < 6) {
        color = '#FF9800' // Orange for jogging
      } else if (speed < 10) {
        color = '#4CAF50' // Green for running
      } else {
        color = '#2196F3' // Blue for fast running
      }

      segments.push({
        coordinates: [
          { latitude: prevPoint.latitude, longitude: prevPoint.longitude },
          { latitude: currentPoint.latitude, longitude: currentPoint.longitude },
        ],
        color,
        speed,
      })
    }

    return segments
  }, [route, calculateDistance])

  if (route.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Start running to see your route!</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        provider={PROVIDER_APPLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        mapType="standard"
      >
        {/* Render speed-based polyline segments for heatmap effect */}
        {speedSegments.map((segment, index) => (
          <Polyline
            key={index}
            coordinates={segment.coordinates}
            strokeWidth={6}
            strokeColor={segment.color}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Render main route polyline as backup/base layer */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={3}
            strokeColor={theme.colors.primary}
            lineCap="round"
            lineJoin="round"
            zIndex={0}
          />
        )}
      </MapView>

      {/* Speed legend */}
      {speedSegments.length > 0 && (
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF5722' }]} />
            <Text style={styles.legendText}>Slow</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>Jog</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Run</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Fast</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default RunMapView
