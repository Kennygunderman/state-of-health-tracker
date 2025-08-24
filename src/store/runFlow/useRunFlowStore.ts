import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as Location from 'expo-location'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useAuthStore from '@store/auth/useAuthStore'

export interface LocationPoint {
  latitude: number
  longitude: number
  timestamp: number
  speed?: number | null
  accuracy?: number | null
}

export interface RunStats {
  totalDistance: number // in miles
  totalTime: number // in seconds
  currentPace: number // minutes per mile
  averagePace: number // minutes per mile
  currentSpeed: number // mph
  averageSpeed: number // mph
  calories?: number
}

export interface RunSession {
  id: string
  startTime: number
  endTime?: number
  route: LocationPoint[]
  stats: RunStats
  isActive: boolean
  isPaused: boolean
  pausedAt?: number // When the current pause started
  totalPausedTime: number // Total time spent paused in milliseconds
}

export interface RunFlowState {
  currentSession: RunSession | null
  isTracking: boolean
  hasLocationPermission: boolean
  isSimulationMode: boolean
  
  // Run history
  runHistory: RunSession[]
  isLoadingHistory: boolean
  
  // Actions
  startRun: () => Promise<void>
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => Promise<RunSession>
  cancelRun: () => void
  addLocationPoint: (location: Location.LocationObject) => void
  checkPermissions: () => Promise<boolean>
  requestPermissions: () => Promise<boolean>
  
  // History management
  loadRunHistory: () => Promise<void>
  deleteRun: (runId: string) => Promise<void>
  
  // Simulation
  startSimulation: () => void
  
  // Utilities
  calculateDistance: (point1: LocationPoint, point2: LocationPoint) => number
  calculatePace: (distance: number, time: number) => number
  updateStats: () => void
}

const useRunFlowStore = create<RunFlowState>()(
  immer((set, get) => {
    const generateId = () => `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
    
    return {
      currentSession: null,
      isTracking: false,
      hasLocationPermission: false,
      isSimulationMode: false,
      
      // Run history
      runHistory: [],
      isLoadingHistory: false,
      
      checkPermissions: async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync()
          const hasPermission = status === 'granted'
          
          set(state => {
            state.hasLocationPermission = hasPermission
          })
          
          return hasPermission
        } catch (error) {
          console.error('Error checking location permissions:', error)
          return false
        }
      },
      
      requestPermissions: async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync()
          const hasPermission = status === 'granted'
          
          set(state => {
            state.hasLocationPermission = hasPermission
          })
          
          return hasPermission
        } catch (error) {
          console.error('Error requesting location permissions:', error)
          return false
        }
      },
      
      calculateDistance: (point1: LocationPoint, point2: LocationPoint) => {
        return haversineDistance(point1.latitude, point1.longitude, point2.latitude, point2.longitude)
      },
      
      calculatePace: (distance: number, time: number) => {
        if (distance === 0) return 0
        return time / 60 / distance // minutes per mile
      },
      
      updateStats: () => {
        set(state => {
          if (!state.currentSession) return
          
          const { route, startTime, totalPausedTime, isPaused, pausedAt } = state.currentSession
          
          // Calculate active time (excluding paused time)
          let currentPausedTime = totalPausedTime
          if (isPaused && pausedAt) {
            // Add current pause duration if currently paused
            currentPausedTime += Date.now() - pausedAt
          }
          const totalTime = (Date.now() - startTime - currentPausedTime) / 1000 // Active time in seconds
          
          if (route.length < 2) {
            state.currentSession.stats = {
              totalDistance: 0,
              totalTime,
              currentPace: 0,
              averagePace: 0,
              currentSpeed: 0,
              averageSpeed: 0
            }
            return
          }
          
          // Calculate total distance
          let totalDistance = 0
          for (let i = 1; i < route.length; i++) {
            totalDistance += haversineDistance(
              route[i-1].latitude, route[i-1].longitude,
              route[i].latitude, route[i].longitude
            )
          }
          
          const averagePace = totalDistance > 0 ? (totalTime / 60) / totalDistance : 0 // minutes per mile
          const averageSpeed = totalDistance > 0 ? totalDistance / (totalTime / 3600) : 0
          
          // Calculate current speed/pace using a rolling average for stability
          let currentSpeed = 0
          let currentPace = 0
          
          if (route.length >= 5) {
            // Use last 5 points for more stable current pace calculation
            let recentDistance = 0
            let recentTime = 0
            
            for (let i = route.length - 4; i < route.length; i++) {
              const segmentDistance = haversineDistance(
                route[i-1].latitude, route[i-1].longitude,
                route[i].latitude, route[i].longitude
              )
              const segmentTime = (route[i].timestamp - route[i-1].timestamp) / 1000
              
              if (segmentTime > 0 && segmentDistance > 0.001) { // Filter out very small movements
                recentDistance += segmentDistance
                recentTime += segmentTime
              }
            }
            
            if (recentTime > 0 && recentDistance > 0) {
              currentSpeed = recentDistance / (recentTime / 3600) // mph
              currentPace = (recentTime / 60) / recentDistance // minutes per mile
            } else {
              // Fallback to average pace if no good recent data
              currentSpeed = averageSpeed
              currentPace = averagePace
            }
          } else if (route.length >= 2) {
            // For early in the run, just use average pace to avoid wild fluctuations
            currentSpeed = averageSpeed
            currentPace = averagePace
          }
          
          state.currentSession.stats = {
            totalDistance,
            totalTime,
            currentPace,
            averagePace,
            currentSpeed,
            averageSpeed,
            calories: Math.round(totalDistance * 100) // Rough estimation: 100 calories per mile
          }
        })
      },
      
      startRun: async () => {
        const hasPermission = await get().requestPermissions()
        
        if (!hasPermission) {
          throw new Error('Location permission denied')
        }
        
        const newSession: RunSession = {
          id: generateId(),
          startTime: Date.now(),
          route: [],
          stats: {
            totalDistance: 0,
            totalTime: 0,
            currentPace: 0,
            averagePace: 0,
            currentSpeed: 0,
            averageSpeed: 0
          },
          isActive: true,
          isPaused: false,
          totalPausedTime: 0
        }
        
        set(state => {
          state.currentSession = newSession
          state.isTracking = true
        })
      },
      
      pauseRun: () => {
        set(state => {
          if (state.currentSession) {
            state.currentSession.isPaused = true
            state.currentSession.pausedAt = Date.now()
            state.isTracking = false
          }
        })
      },
      
      resumeRun: () => {
        set(state => {
          if (state.currentSession && state.currentSession.pausedAt) {
            // Add the pause duration to total paused time
            const pauseDuration = Date.now() - state.currentSession.pausedAt
            state.currentSession.totalPausedTime += pauseDuration
            state.currentSession.pausedAt = undefined
            state.currentSession.isPaused = false
            state.isTracking = true
          }
        })
      },
      
      cancelRun: () => {
        set(state => {
          state.currentSession = null
          state.isTracking = false
          state.isSimulationMode = false
        })
      },
      
      stopRun: async () => {
        const session = get().currentSession
        
        if (!session) {
          throw new Error('No active run session')
        }
        
        const completedSession = {
          ...session,
          endTime: Date.now(),
          isActive: false,
          isPaused: false
        }
        
        // Save run to storage
        try {
          const {userId} = useAuthStore.getState()
          if (userId) {
            // Convert RunSession to RunData format for storage
            const runData = {
              id: completedSession.id,
              userId,
              startTime: completedSession.startTime,
              endTime: completedSession.endTime,
              coordinates: completedSession.route.map(point => ({
                latitude: point.latitude,
                longitude: point.longitude,
                timestamp: point.timestamp,
                speed: point.speed || 0,
                accuracy: point.accuracy || 0
              })),
              segments: [], // Not implemented yet
              stats: {
                totalDistance: completedSession.stats.totalDistance,
                totalDuration: completedSession.stats.totalTime * 1000, // Convert to milliseconds
                avgSpeed: completedSession.stats.averageSpeed,
                maxSpeed: completedSession.stats.currentSpeed,
                avgPace: completedSession.stats.averagePace,
                calories: completedSession.stats.calories
              },
              isActive: false,
              isPaused: false,
              pausedDuration: 0,
              name: `Run ${new Date(completedSession.startTime).toLocaleDateString()}`,
              notes: undefined
            }
            
            await offlineWorkoutStorageService.saveRun(runData)
            
            // Add to local history
            set(state => {
              state.runHistory.unshift(completedSession)
            })
            
            console.log('Run saved successfully!')
          }
        } catch (error) {
          console.error('Error saving run:', error)
        }
        
        set(state => {
          state.currentSession = null
          state.isTracking = false
        })
        
        return completedSession
      },
      
      addLocationPoint: (location: Location.LocationObject) => {
        set(state => {
          if (!state.currentSession || !state.isTracking) return
          
          const newPoint: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            speed: location.coords.speed,
            accuracy: location.coords.accuracy
          }
          
          state.currentSession.route.push(newPoint)
        })
        
        // Update stats after adding point
        get().updateStats()
      },
      
      loadRunHistory: async () => {
        set(state => {
          state.isLoadingHistory = true
        })
        
        try {
          const {userId} = useAuthStore.getState()
          if (userId) {
            const savedRuns = await offlineWorkoutStorageService.getRuns(userId)
            
            // Convert RunData back to RunSession format
            const runSessions: RunSession[] = savedRuns.map(runData => {
              // Calculate duration properly
              let totalTime = 0
              if (runData.endTime && runData.startTime) {
                totalTime = (runData.endTime - runData.startTime) / 1000 // Convert to seconds
              } else if (runData.stats.totalDuration) {
                totalTime = Math.abs(runData.stats.totalDuration / 1000) // Convert to seconds and ensure positive
              }
              
              return {
                id: runData.id,
                startTime: runData.startTime,
                endTime: runData.endTime,
                route: runData.coordinates?.map(coord => ({
                  latitude: coord.latitude,
                  longitude: coord.longitude,
                  timestamp: coord.timestamp,
                  speed: coord.speed,
                  accuracy: coord.accuracy
                })) || [],
                stats: {
                  totalDistance: runData.stats.totalDistance || 0,
                  totalTime: totalTime,
                  currentPace: runData.stats.avgPace || 0,
                  averagePace: runData.stats.avgPace || 0,
                  currentSpeed: runData.stats.maxSpeed || 0,
                  averageSpeed: runData.stats.avgSpeed || 0,
                  calories: runData.stats.calories
                },
                isActive: false,
                isPaused: false,
                totalPausedTime: 0 // Default for historical runs
              }
            })
            
            set(state => {
              state.runHistory = runSessions.sort((a, b) => b.startTime - a.startTime)
              state.isLoadingHistory = false
            })
          }
        } catch (error) {
          console.error('Error loading run history:', error)
          set(state => {
            state.isLoadingHistory = false
          })
        }
      },
      
      deleteRun: async (runId: string) => {
        try {
          await offlineWorkoutStorageService.deleteRun(runId)
          
          set(state => {
            state.runHistory = state.runHistory.filter(run => run.id !== runId)
          })
        } catch (error) {
          console.error('Error deleting run:', error)
        }
      },
      
      startSimulation: () => {
        const newSession: RunSession = {
          id: generateId(),
          startTime: Date.now(),
          route: [
            // Simulate a simple route with some fake GPS points
            { latitude: 37.7749, longitude: -122.4194, timestamp: Date.now() },
            { latitude: 37.7750, longitude: -122.4195, timestamp: Date.now() + 30000 },
            { latitude: 37.7751, longitude: -122.4196, timestamp: Date.now() + 60000 },
            { latitude: 37.7752, longitude: -122.4197, timestamp: Date.now() + 90000 },
            { latitude: 37.7753, longitude: -122.4198, timestamp: Date.now() + 120000 }
          ],
          stats: {
            totalDistance: 0.5, // Half a mile
            totalTime: 240, // 4 minutes
            currentPace: 8.0, // 8 minutes per mile
            averagePace: 8.0,
            currentSpeed: 7.5, // 7.5 mph
            averageSpeed: 7.5,
            calories: 50
          },
          isActive: true,
          isPaused: false,
          totalPausedTime: 0
        }
        
        set(state => {
          state.currentSession = newSession
          state.isTracking = true
          state.isSimulationMode = true
        })
      }
    }
  })
)

export default useRunFlowStore
