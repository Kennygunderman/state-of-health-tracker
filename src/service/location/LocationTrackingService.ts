import * as Location from 'expo-location'
import { LocationObject } from 'expo-location'
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake'

export interface LocationTrackingOptions {
  accuracy: Location.Accuracy
  distanceInterval: number // meters
  timeInterval: number // milliseconds
}

export class LocationTrackingService {
  private watchSubscription: Location.LocationSubscription | null = null
  private isTracking = false
  
  private defaultOptions: LocationTrackingOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5, // 5 meters
    timeInterval: 1000   // 1 second
  }
  
  /**
   * Start tracking location with the provided callback
   */
  async startTracking(
    callback: (location: LocationObject) => void,
    options: Partial<LocationTrackingOptions> = {}
  ): Promise<void> {
    if (this.isTracking) {
      console.warn('Location tracking is already active')
      return
    }
    
    try {
      // Check permissions
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync()
      
      if (foregroundStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          throw new Error('Foreground location permission not granted')
        }
      }
      
      // Request background permission for continuous tracking
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync()
      if (backgroundStatus !== 'granted') {
        const { status: newBackgroundStatus } = await Location.requestBackgroundPermissionsAsync()
        if (newBackgroundStatus !== 'granted') {
          console.warn('Background location permission not granted - tracking may stop when app is backgrounded')
        }
      }
      
      const trackingOptions = { ...this.defaultOptions, ...options }
      
      // Keep the device awake during tracking
      activateKeepAwake('LocationTracking')
      
      // Start location watching
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: trackingOptions.accuracy,
          timeInterval: trackingOptions.timeInterval,
          distanceInterval: trackingOptions.distanceInterval,
          mayShowUserSettingsDialog: true,
        },
        (location) => {
          callback(location)
        }
      )
      
      this.isTracking = true
      console.log('Location tracking started successfully')
      
    } catch (error) {
      console.error('Failed to start location tracking:', error)
      throw error
    }
  }
  
  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      console.warn('Location tracking is not active')
      return
    }
    
    try {
      if (this.watchSubscription) {
        this.watchSubscription.remove()
        this.watchSubscription = null
      }
      
      // Allow device to sleep again
      deactivateKeepAwake('LocationTracking')
      
      this.isTracking = false
      console.log('Location tracking stopped successfully')
      
    } catch (error) {
      console.error('Error stopping location tracking:', error)
      throw error
    }
  }
  
  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<LocationObject> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync()
        if (newStatus !== 'granted') {
          throw new Error('Location permission not granted')
        }
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 5000, // 5 seconds
        timeout: 10000    // 10 seconds
      })
      
      return location
      
    } catch (error) {
      console.error('Failed to get current location:', error)
      throw error
    }
  }
  
  /**
   * Check if location services are enabled
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync()
    } catch (error) {
      console.error('Error checking location services:', error)
      return false
    }
  }
  
  /**
   * Check current permission status
   */
  async getPermissionStatus(): Promise<{
    foreground: Location.PermissionStatus
    background: Location.PermissionStatus
  }> {
    try {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync()
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync()
      
      return {
        foreground: foregroundStatus,
        background: backgroundStatus
      }
    } catch (error) {
      console.error('Error checking permission status:', error)
      return {
        foreground: Location.PermissionStatus.UNDETERMINED,
        background: Location.PermissionStatus.UNDETERMINED
      }
    }
  }
  
  /**
   * Get whether tracking is currently active
   */
  getIsTracking(): boolean {
    return this.isTracking
  }
  
  /**
   * Calculate distance between two points using Haversine formula
   */
  static calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
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
  
  /**
   * Calculate speed in mph from location objects
   */
  static calculateSpeed(
    location1: LocationObject, 
    location2: LocationObject
  ): number {
    const distance = LocationTrackingService.calculateDistance(
      location1.coords.latitude,
      location1.coords.longitude,
      location2.coords.latitude,
      location2.coords.longitude
    )
    
    const timeDiff = (location2.timestamp - location1.timestamp) / 1000 / 3600 // hours
    
    return timeDiff > 0 ? distance / timeDiff : 0
  }
}

// Create a singleton instance
export const locationTrackingService = new LocationTrackingService()
