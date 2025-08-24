import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {v4 as uuidv4} from 'uuid'

import {RunData, RunSession, RunStatus, GPSCoordinate, RunStats} from '@types/run'
import runTrackingService from '@service/run/RunTrackingService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useAuthStore from '@store/auth/useAuthStore'


export interface RunState {
  // Current active run session
  currentSession: RunSession | null
  runStatus: RunStatus
  
  // Run history
  runs: RunData[]
  
  // Loading states
  isStartingRun: boolean
  isLoadingRuns: boolean
  
  // Actions
  startRun: () => Promise<boolean>
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => Promise<RunData | null>
  completeRun: () => Promise<RunData | null>
  
  // History management
  loadRunHistory: () => Promise<void>
  deleteRun: (runId: string) => Promise<void>
  
  // Session updates
  updateCurrentLocation: (coordinate: GPSCoordinate) => void
  
  // Reset
  resetRunState: () => void
}

const useRunStore = create<RunState>()(
  immer((set, get) => ({
    // Initial state
    currentSession: null,
    runStatus: RunStatus.NOT_STARTED,
    runs: [],
    isStartingRun: false,
    isLoadingRuns: false,

    // Start a new run
    startRun: async () => {
      console.log('Starting new run...')
      set({isStartingRun: true})
      
      try {
        const {userId} = useAuthStore.getState()
        if (!userId) {
          throw new Error('User not authenticated')
        }

        console.log('User authenticated, creating session...')
        
        // Create new run session
        const sessionId = uuidv4()
        const startTime = Date.now()
        
        const newSession: RunSession = {
          id: sessionId,
          startTime,
          currentDistance: 0,
          currentDuration: 0,
          currentSpeed: 0,
          isActive: true,
          isPaused: false,
          coordinates: [],
          lastUpdate: startTime
        }

        console.log('Session created, starting GPS tracking...')
        
        // Start GPS tracking
        const trackingStarted = await runTrackingService.startTracking((coordinate) => {
          console.log('Location callback triggered:', coordinate)
          const {updateCurrentLocation} = get()
          updateCurrentLocation(coordinate)
        })

        console.log('GPS tracking result:', trackingStarted)
        
        if (!trackingStarted) {
          throw new Error('Failed to start GPS tracking')
        }

        console.log('Setting active run state...')
        
        set({
          currentSession: newSession,
          runStatus: RunStatus.ACTIVE,
          isStartingRun: false
        })

        console.log('Run started successfully!')
        return true
      } catch (error) {
        console.error('Error starting run:', error)
        set({isStartingRun: false})
        return false
      }
    },

    // Pause the current run
    pauseRun: () => {
      const {currentSession} = get()
      if (!currentSession || !currentSession.isActive) return

      runTrackingService.pauseTracking()
      
      set(state => {
        if (state.currentSession) {
          state.currentSession.isPaused = true
          state.runStatus = RunStatus.PAUSED
        }
      })
    },

    // Resume the current run
    resumeRun: () => {
      const {currentSession} = get()
      if (!currentSession || currentSession.isActive) return

      runTrackingService.resumeTracking()
      
      set(state => {
        if (state.currentSession) {
          state.currentSession.isPaused = false
          state.runStatus = RunStatus.ACTIVE
        }
      })
    },

    // Stop the current run without saving
    stopRun: async () => {
      const {currentSession} = get()
      if (!currentSession) return null

      await runTrackingService.stopTracking()
      
      set({
        currentSession: null,
        runStatus: RunStatus.STOPPED
      })

      return null
    },

    // Complete and save the current run
    completeRun: async () => {
      const {currentSession, runs} = get()
      if (!currentSession) return null

      const {userId} = useAuthStore.getState()
      if (!userId) return null

      await runTrackingService.stopTracking()

      // Calculate final stats
      const endTime = Date.now()
      const totalDuration = endTime - currentSession.startTime
      const stats = runTrackingService.calculateRunStats(currentSession.coordinates, totalDuration)

      // Create completed run data
      const completedRun: RunData = {
        id: currentSession.id,
        userId,
        startTime: currentSession.startTime,
        endTime,
        coordinates: currentSession.coordinates,
        segments: [], // TODO: Implement segment calculation if needed
        stats,
        isActive: false,
        isPaused: false,
        pausedDuration: 0, // TODO: Track actual paused time
        name: `Run ${new Date(currentSession.startTime).toLocaleDateString()}`,
        notes: undefined
      }

      // Save run locally (no longer adding to workout log)
      try {
        await offlineWorkoutStorageService.saveRun(completedRun)
        
        set(state => {
          state.runs.unshift(completedRun) // Add to beginning of array
          state.currentSession = null
          state.runStatus = RunStatus.COMPLETED
        })

        console.log('Run saved successfully (standalone, not in workout log)')
        return completedRun
      } catch (error) {
        console.error('Error saving completed run:', error)
        return null
      }
    },

    // Update current location during active run
    updateCurrentLocation: (coordinate: GPSCoordinate) => {
      const {currentSession} = get()
      if (!currentSession || currentSession.isPaused) return

      const now = Date.now()
      
      set(state => {
        if (state.currentSession) {
          state.currentSession.coordinates.push(coordinate)
          state.currentSession.currentDistance = runTrackingService.calculateTotalDistance(
            state.currentSession.coordinates
          )
          state.currentSession.currentDuration = now - state.currentSession.startTime
          state.currentSession.currentSpeed = coordinate.speed || 0
          state.currentSession.lastUpdate = now
        }
      })
    },

    // Load run history from storage
    loadRunHistory: async () => {
      const {userId} = useAuthStore.getState()
      if (!userId) return

      set({isLoadingRuns: true})
      
      try {
        const savedRuns = await offlineWorkoutStorageService.getRuns(userId)
        set({
          runs: savedRuns.sort((a: RunData, b: RunData) => b.startTime - a.startTime), // Sort by newest first
          isLoadingRuns: false
        })
      } catch (error) {
        console.error('Error loading run history:', error)
        set({isLoadingRuns: false})
      }
    },

    // Delete a run from history
    deleteRun: async (runId: string) => {
      try {
        await offlineWorkoutStorageService.deleteRun(runId)
        
        set(state => {
          state.runs = state.runs.filter(run => run.id !== runId)
        })
      } catch (error) {
        console.error('Error deleting run:', error)
      }
    },

    // Reset all run state
    resetRunState: () => {
      runTrackingService.stopTracking()
      
      set({
        currentSession: null,
        runStatus: RunStatus.NOT_STARTED,
        runs: [],
        isStartingRun: false,
        isLoadingRuns: false
      })
    }
  }))
)

export default useRunStore
