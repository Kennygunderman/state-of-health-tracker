import {syncWorkoutDay} from '@service/workouts/syncWorkoutDay'

import {fetchWorkoutForDay} from '@service/workouts/fetchWorkoutForDay'
import {updateWorkoutDay} from '@service/workouts/updateWorkoutDay'
import {saveWorkoutDay} from '@service/workouts/saveWorkoutDay'
import {createWorkoutDay} from '@data/models/WorkoutDay'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'

const mockFetch = fetchWorkoutForDay as jest.Mock
const mockUpdate = updateWorkoutDay as jest.Mock
const mockSave = saveWorkoutDay as jest.Mock
const mockCreate = createWorkoutDay as jest.Mock
const mockFindLocal = offlineWorkoutStorageService.findLocalWorkoutByDate as jest.Mock
const mockSaveLocal = offlineWorkoutStorageService.save as jest.Mock

jest.mock('@service/workouts/fetchWorkoutForDay', () => ({
  fetchWorkoutForDay: jest.fn()
}))
jest.mock('@service/workouts/updateWorkoutDay', () => ({
  updateWorkoutDay: jest.fn()
}))
jest.mock('@service/workouts/saveWorkoutDay', () => ({
  saveWorkoutDay: jest.fn()
}))
jest.mock('@data/models/WorkoutDay', () => ({
  createWorkoutDay: jest.fn()
}))
jest.mock('@service/workouts/OfflineWorkoutStorageService', () => ({
  findLocalWorkoutByDate: jest.fn(),
  save: jest.fn()
}))

const today = '2024-07-01'
const userId = 'user-123'

const remoteWorkout = {id: 'r1', userId, date: today, updatedAt: 10, synced: true, dailyExercises: []}
const localWorkoutOlder = {id: 'l1', userId, date: today, updatedAt: 5, synced: true, dailyExercises: []}
const localWorkoutNewerUnsynced = {id: 'l2', userId, date: today, updatedAt: 15, synced: false, dailyExercises: []}
const updatedWorkout = {...localWorkoutNewerUnsynced, synced: true}
const newRemoteWorkout = {id: 'newRemote', userId, date: today, updatedAt: 20, synced: true, dailyExercises: []}
const newLocalWorkout = {id: undefined, userId, date: today, updatedAt: 30, dailyExercises: []}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('syncWorkoutDay', () => {
  test('Remote exists, local is older => saves remote locally and returns remote', async () => {
    mockFetch.mockResolvedValue(remoteWorkout)
    mockFindLocal.mockResolvedValue(localWorkoutOlder)

    const result = await syncWorkoutDay(today, userId)

    expect(mockSaveLocal).toHaveBeenCalledWith(remoteWorkout)
    expect(result).toEqual(remoteWorkout)
  })

  test('Remote exists, local is newer and unsynced => updates remote and returns updated workout', async () => {
    mockFetch.mockResolvedValue(remoteWorkout)
    mockFindLocal.mockResolvedValue(localWorkoutNewerUnsynced)
    mockUpdate.mockResolvedValue(updatedWorkout)

    const result = await syncWorkoutDay(today, userId)

    expect(mockUpdate).toHaveBeenCalledWith(localWorkoutNewerUnsynced)
    expect(result).toEqual(updatedWorkout)
  })

  test('Remote exists, no local => saves remote locally and returns remote', async () => {
    mockFetch.mockResolvedValue(remoteWorkout)
    mockFindLocal.mockResolvedValue(null)

    const result = await syncWorkoutDay(today, userId)

    expect(mockSaveLocal).toHaveBeenCalledWith(remoteWorkout)
    expect(result).toEqual(remoteWorkout)
  })

  test('No remote, local exists => saves local to remote and returns new remote', async () => {
    mockFetch.mockResolvedValue(null)
    mockFindLocal.mockResolvedValue(localWorkoutOlder)
    mockSave.mockResolvedValue(newRemoteWorkout)

    const result = await syncWorkoutDay(today, userId)

    expect(mockSave).toHaveBeenCalledWith(localWorkoutOlder)
    expect(mockSaveLocal).toHaveBeenCalledWith(newRemoteWorkout)
    expect(result).toEqual(newRemoteWorkout)
  })

  test('No remote, no local => creates new local workout and returns it', async () => {
    mockFetch.mockResolvedValue(null)
    mockFindLocal.mockResolvedValue(null)
    mockCreate.mockReturnValue(newLocalWorkout)

    const result = await syncWorkoutDay(today, userId)

    expect(mockCreate).toHaveBeenCalledWith(userId, today)
    expect(mockSaveLocal).toHaveBeenCalledWith(newLocalWorkout)
    expect(result).toEqual(newLocalWorkout)
  })

  test('Remote fetch fails, local exists => returns local', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    mockFindLocal.mockResolvedValue(localWorkoutOlder)

    const result = await syncWorkoutDay(today, userId)

    expect(result).toEqual(localWorkoutOlder)
  })

  test('Remote fetch fails, no local => creates new local workout', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    mockFindLocal.mockResolvedValue(null)
    mockCreate.mockReturnValue(newLocalWorkout)

    const result = await syncWorkoutDay(today, userId)

    expect(result).toEqual(newLocalWorkout)
  })

  test('Remote creation fails, local exists => returns local', async () => {
    mockFetch.mockResolvedValue(null)
    mockFindLocal.mockResolvedValue(localWorkoutOlder)
    mockSave.mockRejectedValue(new Error('creation failed'))

    const result = await syncWorkoutDay(today, userId)

    expect(result).toEqual(localWorkoutOlder)
  })

  test('Remote creation fails, no local => creates new local workout', async () => {
    mockFetch.mockResolvedValue(null)
    mockFindLocal.mockResolvedValue(null)
    mockSave.mockRejectedValue(new Error('creation failed'))
    mockCreate.mockReturnValue(newLocalWorkout)

    const result = await syncWorkoutDay(today, userId)

    expect(result).toEqual(newLocalWorkout)
  })
})
