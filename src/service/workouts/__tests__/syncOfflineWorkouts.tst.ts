// Mocks
import syncOfflineWorkouts from '@service/workouts/syncOfflineWorkouts'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import {saveWorkoutDay} from '@service/workouts/saveWorkoutDay'
import CrashUtility from '../../../utility/CrashUtility'

jest.mock('@service/workouts/OfflineWorkoutStorageService', () => ({
  readAll: jest.fn(),
  save: jest.fn(),
  deleteByDate: jest.fn(),
  deleteAllSynced: jest.fn()
}))

jest.mock('@service/workouts/saveWorkoutDay', () => ({
  saveWorkoutDay: jest.fn()
}))

jest.mock('../../../utility/CrashUtility', () => ({
  recordError: jest.fn()
}))

const mockReadAll = offlineWorkoutStorageService.readAll as jest.Mock
const mockSave = offlineWorkoutStorageService.save as jest.Mock
const mockDeleteByDate = offlineWorkoutStorageService.deleteByDate as jest.Mock
const mockDeleteAllSynced = offlineWorkoutStorageService.deleteAllSynced as jest.Mock
const mockSaveWorkoutDay = saveWorkoutDay as jest.Mock
const mockRecordError = CrashUtility.recordError as jest.Mock

const TODAY_ISO = '2025-10-20'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('syncOfflineWorkouts', () => {
  test('skips workout with date equal to today', async () => {
    mockReadAll.mockResolvedValue([{date: '2025-10-20T00:00:00Z', synced: false}])

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockSaveWorkoutDay).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  })

  test('skips workout already synced', async () => {
    mockReadAll.mockResolvedValue([{date: '2025-10-19', synced: true}])

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockSaveWorkoutDay).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  })

  test('saves unsynced workout successfully', async () => {
    mockReadAll.mockResolvedValue([{date: '2025-10-19', synced: false}])
    mockSaveWorkoutDay.mockResolvedValue(true)

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockSaveWorkoutDay).toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        synced: true,
        syncAttempts: 0
      })
    )
  })

  test('increments syncAttempts on failure < 3', async () => {
    mockReadAll.mockResolvedValue([{date: '2025-10-19', synced: false, syncAttempts: 1}])
    mockSaveWorkoutDay.mockRejectedValue(new Error('fail'))

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        syncAttempts: 2
      })
    )
    expect(mockDeleteByDate).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  test('deletes workout after 3 failed attempts', async () => {
    mockReadAll.mockResolvedValue([{date: '2025-10-19', synced: false, syncAttempts: 2}])
    mockSaveWorkoutDay.mockRejectedValue(new Error('fail'))

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockDeleteByDate).toHaveBeenCalledWith('2025-10-19')
    expect(mockSave).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  test('handles malformed date gracefully', async () => {
    mockReadAll.mockResolvedValue([{date: 'not-a-date', synced: false}])
    mockSaveWorkoutDay.mockResolvedValue(true)

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockSaveWorkoutDay).toHaveBeenCalled()
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        synced: true,
        syncAttempts: 0
      })
    )
  })

  test('calls deleteAllSynced at the end', async () => {
    mockReadAll.mockResolvedValue([])

    await syncOfflineWorkouts(TODAY_ISO)

    expect(mockDeleteAllSynced).toHaveBeenCalled()
  })
})
