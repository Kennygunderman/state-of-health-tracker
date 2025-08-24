export interface GPSCoordinate {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  speed?: number
  timestamp: number
}

export interface RunSegment {
  coordinates: GPSCoordinate[]
  distance: number // in meters
  duration: number // in milliseconds
  avgSpeed: number // in m/s
  maxSpeed: number // in m/s
  minSpeed: number // in m/s
}

export interface RunStats {
  totalDistance: number // in meters
  totalDuration: number // in milliseconds
  avgSpeed: number // in m/s
  maxSpeed: number // in m/s
  avgPace: number // in seconds per kilometer
  calories?: number
}

export interface RunData {
  id: string
  userId: string
  startTime: number
  endTime?: number
  coordinates: GPSCoordinate[]
  segments: RunSegment[]
  stats: RunStats
  isActive: boolean
  isPaused: boolean
  pausedDuration: number // total time paused in milliseconds
  name?: string
  notes?: string
}

export interface RunSession {
  id: string
  startTime: number
  currentDistance: number
  currentDuration: number
  currentSpeed: number
  isActive: boolean
  isPaused: boolean
  coordinates: GPSCoordinate[]
  lastUpdate: number
}

export enum RunStatus {
  NOT_STARTED = 'not_started',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  STOPPED = 'stopped'
}

export interface RunHeatmapPoint {
  latitude: number
  longitude: number
  intensity: number // 0-1, where 1 is fastest speed
  speed: number
}

export interface RunMapData {
  routeCoordinates: GPSCoordinate[]
  heatmapPoints: RunHeatmapPoint[]
  bounds: {
    northeast: {latitude: number; longitude: number}
    southwest: {latitude: number; longitude: number}
  }
}
