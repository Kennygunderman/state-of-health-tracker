import {useEffect, useState} from 'react'

import {ScrollView} from 'react-native'

import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useExercisesStore from '@store/exercises/useExercisesStore'
import useExerciseTemplateStore from '@store/exerciseTemplates/useExerciseTemplateStore'
import useWeeklyWorkoutSummariesStore from '@store/weeklyWorkoutSummaries/useWeeklyWorkoutSummariesStore'
import useWorkoutSummariesStore from '@store/workoutSummaries/useWorkoutSummariesStore'
import {Text} from '@theme/Theme'

import PrimaryButton from '@components/PrimaryButton'

const DebugScreen = () => {
  const {currentWorkoutDay} = useDailyWorkoutEntryStore()
  const {exercises} = useExercisesStore()
  const {summaries} = useWorkoutSummariesStore()
  const {weeklySummaries} = useWeeklyWorkoutSummariesStore()
  const {templates} = useExerciseTemplateStore()

  const [offlineWorkouts, setOfflineWorkouts] = useState([])

  useEffect(() => {
    offlineWorkoutStorageService.readAll().then(res => {
      // setOfflineWorkouts(res)
    })
  }, [])

  return (
    <ScrollView style={{marginTop: 80}}>
      <PrimaryButton
        label={'Refresh offline workouts'}
        onPress={() => {
          offlineWorkoutStorageService.readAll().then(res => {
            // setOfflineWorkouts(res)
          })
        }}
      />

      {/* <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Templates:</Text> */}
      {/* <Text style={{ marginBottom: 20 }}> */}
      {/*   {JSON.stringify(templates, null, 2)} */}
      {/* </Text> */}

      <Text style={{fontWeight: 'bold', marginBottom: 10}}>Offline Workouts:</Text>
      <Text style={{marginBottom: 20}}>{JSON.stringify(offlineWorkouts, null, 2)}</Text>

      {/* <Text> */}
      {/*   <Text style={{fontWeight: 'bold'}}>Current Workout Day:</Text> {JSON.stringify(currentWorkoutDay, null, 2)} */}
      {/* </Text> */}
    </ScrollView>
  )
}

export default DebugScreen
