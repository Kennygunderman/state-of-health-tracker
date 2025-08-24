import React, {useCallback, useEffect, useState} from 'react'

import {FlatList, ListRenderItemInfo, View} from 'react-native'

import {mapExerciseType} from '@data/converters/ExerciseConverter'
import {CreateExercisePayload} from '@data/models/Exercise'
import {useNavigation} from '@react-navigation/native'
import exerciseSearchService from '@service/exercises/ExerciseSearchService'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useExercisesStore from '@store/exercises/useExercisesStore'
import {useStyleTheme} from '@theme/Theme'
import {debounce} from 'lodash'

import {CreateExerciseEvent, CreateExerciseEventSubject$} from '@screens/CreateExercise'

import ExerciseTypeChip from '@components/ExerciseTypeChip'
import ListItem from '@components/ListItem'
import LoadingOverlay from '@components/LoadingOverlay'
import SearchBar from '@components/SearchBar'
import {showToast} from '@components/toast/util/ShowToast'

import Spacing from '@constants/Spacing'
import {SEARCH_ADD_EXERCISE_ERROR, SEARCH_ADD_EXERCISE_SUCCESS, SEARCH_EXERCISES_PLACEHOLDER} from '@constants/Strings'
import Screens from '@constants/Screens'

import styles from './index.styled'
import {Navigation} from '../../navigation/types'

const LoadBatchSize = 50

const SearchExercisesScreen = () => {
  const navigation = useNavigation<Navigation>()
  const theme = useStyleTheme()

  const [searchText, setSearchText] = useState('')
  const [results, setResults] = useState<CreateExercisePayload[]>([])
  const [batchCount, setBatchCount] = useState(1)
  const [isCreatingExercise, setIsCreatingExercise] = useState(false)

  const {createExercise, findExercise} = useExercisesStore()
  const {addDailyExercise} = useDailyWorkoutEntryStore()

  const debouncedSearch = useCallback(
    debounce((filter: string) => {
      const searchResults = exerciseSearchService.searchExercises(filter, LoadBatchSize * 2)

      setResults(searchResults.slice(0, LoadBatchSize))
      setBatchCount(1)
    }, 300),
    []
  )

  useEffect(() => {
    const sub = CreateExerciseEventSubject$.subscribe({
      next: ({event, payload}) => {
        if (event === CreateExerciseEvent.Created || event === CreateExerciseEvent.Exists) {
          const exercise = findExercise(payload.name, payload.exerciseType)

          if (exercise) {
            // Skip running exercises since they now have a dedicated Run tab
            if (exercise.name === 'Running' && exercise.exerciseBodyPart === 'Cardio') {
              showToast('info', 'Use the Run tab to track your runs', '')
            } else {
              showToast('success', SEARCH_ADD_EXERCISE_SUCCESS, payload.name)
              addDailyExercise(exercise)
            }
            navigation.popToTop()
          }
        } else if (event === CreateExerciseEvent.Error) {
          showToast('error', SEARCH_ADD_EXERCISE_ERROR)
        }
        setIsCreatingExercise(false)
      }
    })

    return () => {
      sub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    debouncedSearch(searchText)

    return debouncedSearch.cancel
  }, [searchText, debouncedSearch])

  const handleLoadMore = () => {
    const nextBatch = batchCount + 1
    const end = nextBatch * LoadBatchSize
    const moreResults = exerciseSearchService.searchExercises(searchText, end)

    setResults(moreResults)
    setBatchCount(nextBatch)
  }

  const onExercisePressed = (exercise: CreateExercisePayload) => {
    setIsCreatingExercise(true)
    createExercise(exercise)
  }

  const renderItem = ({item}: ListRenderItemInfo<CreateExercisePayload>) => (
    <ListItem
      isSwipeable={false}
      leftRightMargin={Spacing.SMALL}
      title={item.name}
      backgroundColor={theme.colors.background}
      subtitle={item.exerciseBodyPart}
      chip={<ExerciseTypeChip exerciseType={mapExerciseType(item.exerciseType)} />}
      onPress={() => onExercisePressed(item)}
    />
  )

  return (
    <View style={styles.container}>
      {isCreatingExercise && <LoadingOverlay />}

      <SearchBar placeholder={SEARCH_EXERCISES_PLACEHOLDER} onSearchTextChanged={setSearchText} />

      <FlatList
        style={styles.listContainer}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        data={results}
        renderItem={renderItem}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
      />
    </View>
  )
}

export default SearchExercisesScreen
