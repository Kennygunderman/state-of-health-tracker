import * as Location from 'expo-location'
import {keepAwake, allowSleepAsync} from 'expo-keep-awake'

import {GPSCoordinate, RunStats, RunSession, RunHeatmapPoint, RunMapData} from '@types/run'

class RunTrackingService {
  private watchSubscription: Location.LocationSubscription | null = null
  private isTracking = false

  // Haversine formula to calculate distance between two GPS points
  private calculateDistance(coord1: GPSCoordinate, coord2: GPSCoordinate): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = this.toRadians(coord2.latitude - coord1.latitude)
    const dLon = this.toRadians(coord2.longitude - coord1.longitude)
    const lat1 = this.toRadians(coord1.latitude)
    const lat2 = this.toRadians(coord2.latitude)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Calculate total distance from array of coordinates
  calculateTotalDistance(coordinates: GPSCoordinate[]): number {
    if (coordinates.length < 2) return 0

    let totalDistance = 0
    for (let i = 1; i < coordinates.length; i++) {
      totalDistance += this.calculateDistance(coordinates[i - 1], coordinates[i])
    }
    return totalDistance
  }

  // Calculate speed between two points
  private calculateSpeed(coord1: GPSCoordinate, coord2: GPSCoordinate): number {
    const distance = this.calculateDistance(coord1, coord2)
    const timeDiff = (coord2.timestamp - coord1.timestamp) / 1000 // seconds
    return timeDiff > 0 ? distance / timeDiff : 0
  }

  // Calculate run statistics
  calculateRunStats(coordinates: GPSCoordinate[], duration: number): RunStats {
    const totalDistance = this.calculateTotalDistance(coordinates)
    const speeds: number[] = []

    // Calculate speeds between consecutive points
    for (let i = 1; i < coordinates.length; i++) {
      const speed = this.calculateSpeed(coordinates[i - 1], coordinates[i])
      if (speed > 0 && speed < 15) {
        // Filter out unrealistic speeds (over 15 m/s = 54 km/h)
        speeds.push(speed)
      }
    }

    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0

    // Calculate pace: time in minutes ÷ distance in miles = minutes per mile
    const totalDistanceInMiles = totalDistance / 1609.34 // Convert meters to miles
    const durationInMinutes = duration / (1000 * 60) // Convert milliseconds to minutes
    const avgPace = totalDistanceInMiles > 0 ? durationInMinutes / totalDistanceInMiles : 0 // minutes per mile

    // Basic calorie calculation (rough estimate)
    const calories = Math.round((totalDistance / 1000) * 65) // ~65 calories per km

    return {
      totalDistance,
      totalDuration: duration,
      avgSpeed,
      maxSpeed,
      avgPace,
      calories
    }
  }

  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      // First request foreground permissions
      const {status: foregroundStatus} = await Location.requestForegroundPermissionsAsync()
      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied')
        return false
      }

      console.log('Foreground location permission granted')

      // Try to request background permission, but don't require it
      try {
        const {status: backgroundStatus} = await Location.requestBackgroundPermissionsAsync()
        if (backgroundStatus === 'granted') {
          console.log('Background location permission granted')
        } else {
          console.log('Background location permission denied, but continuing with foreground only')
        }
      } catch (error) {
        console.log('Background location permission request failed, continuing with foreground only')
      }

      return true // Return true if at least foreground permission is granted
    } catch (error) {
      console.error('Error requesting location permissions:', error)
      return false
    }
  }

  // Start GPS tracking
  async startTracking(onLocationUpdate: (coordinate: GPSCoordinate) => void): Promise<boolean> {
    try {
      console.log('Starting GPS tracking...')

      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        console.log('Permission check failed')
        throw new Error('Location permission denied')
      }

      console.log('Permissions granted, using mock location service for testing')

      // Keep screen awake during run
      keepAwake()

      this.isTracking = true

      // For now, always use mock location service to avoid iOS Simulator issues
      console.log('Starting mock location service...')

      // Start mock location service immediately
      const mockInterval = setInterval(() => {
        if (this.isTracking) {
          // Generate mock location data (simulating movement)
          const baseCoordinate = {
            latitude: 37.7749 + (Math.random() - 0.5) * 0.001, // Small random movement
            longitude: -122.4194 + (Math.random() - 0.5) * 0.001,
            altitude: 50 + Math.random() * 10,
            accuracy: 5 + Math.random() * 3,
            speed: 2 + Math.random() * 3, // 2-5 m/s (jogging speed)
            timestamp: Date.now()
          }

          console.log('Mock location update:', baseCoordinate)
          onLocationUpdate(baseCoordinate)
        }
      }, 2000) // Update every 2 seconds for testing

      // Store the interval so we can clean it up
      this.watchSubscription = {
        remove: () => {
          clearInterval(mockInterval)
        }
      } as Location.LocationSubscription

      console.log('Mock GPS tracking started successfully')
      return true
    } catch (error) {
      console.error('Error starting GPS tracking:', error)
      this.isTracking = false
      return false
    }
  }

  // Stop GPS tracking
  async stopTracking(): Promise<void> {
    this.isTracking = false
    if (this.watchSubscription) {
      this.watchSubscription.remove()
      this.watchSubscription = null
    }
    // Allow device to sleep again
    allowSleepAsync()
  }

  // Pause tracking (keep GPS but don't record locations)
  pauseTracking(): void {
    this.isTracking = false
  }

  // Resume tracking
  resumeTracking(): void {
    this.isTracking = true
  }

  // Generate heatmap data for visualization
  generateHeatmapData(coordinates: GPSCoordinate[]): RunHeatmapPoint[] {
    if (coordinates.length < 2) return []

    const heatmapPoints: RunHeatmapPoint[] = []
    const speeds: number[] = []

    // First pass: calculate all speeds
    for (let i = 1; i < coordinates.length; i++) {
      const speed = this.calculateSpeed(coordinates[i - 1], coordinates[i])
      if (speed > 0 && speed < 15) {
        speeds.push(speed)
      }
    }

    const maxSpeed = Math.max(...speeds)
    const minSpeed = Math.min(...speeds)

    // Second pass: create heatmap points with normalized intensity
    for (let i = 1; i < coordinates.length; i++) {
      const speed = this.calculateSpeed(coordinates[i - 1], coordinates[i])
      if (speed > 0 && speed < 15) {
        const intensity = maxSpeed > minSpeed ? (speed - minSpeed) / (maxSpeed - minSpeed) : 0.5

        heatmapPoints.push({
          latitude: coordinates[i].latitude,
          longitude: coordinates[i].longitude,
          intensity,
          speed
        })
      }
    }

    return heatmapPoints
  }

  // Generate map data for visualization
  generateMapData(coordinates: GPSCoordinate[]): RunMapData {
    if (coordinates.length === 0) {
      return {
        routeCoordinates: [],
        heatmapPoints: [],
        bounds: {
          northeast: {latitude: 0, longitude: 0},
          southwest: {latitude: 0, longitude: 0}
        }
      }
    }

    const heatmapPoints = this.generateHeatmapData(coordinates)

    // Calculate bounds
    const latitudes = coordinates.map(coord => coord.latitude)
    const longitudes = coordinates.map(coord => coord.longitude)

    const bounds = {
      northeast: {
        latitude: Math.max(...latitudes),
        longitude: Math.max(...longitudes)
      },
      southwest: {
        latitude: Math.min(...latitudes),
        longitude: Math.min(...longitudes)
      }
    }

    return {
      routeCoordinates: coordinates,
      heatmapPoints,
      bounds
    }
  }

  // Format time in MM:SS format
  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Format distance in miles with 2 decimal places
  formatDistance(meters: number): string {
    if (typeof meters !== 'number' || isNaN(meters) || meters < 0) {
      return '0.00'
    }
    const miles = meters / 1609.34 // Convert meters to miles
    return miles.toFixed(2)
  }

  // Format pace in min/mile (input is already minutes per mile)
  formatPace(minutesPerMile: number): string {
    if (typeof minutesPerMile !== 'number' || isNaN(minutesPerMile) || minutesPerMile <= 0) {
      return '0:00'
    }
    const minutes = Math.floor(minutesPerMile)
    const seconds = Math.floor((minutesPerMile - minutes) * 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Format speed in mph
  formatSpeed(metersPerSecond: number): string {
    const mph = metersPerSecond * 2.23694 // Convert m/s to mph
    return mph.toFixed(1)
  }
}

export default new RunTrackingService()
