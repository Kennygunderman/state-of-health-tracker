import React, {useEffect, useState} from 'react'

import {SectionList, SectionListRenderItem, View} from 'react-native'

import {Exercise, isExerciseObject} from '@data/models/Exercise'
import {ExerciseTemplate} from '@data/models/ExerciseTemplate'
import {useNavigation} from '@react-navigation/native'
import useExercisesStore from '@store/exercises/useExercisesStore'
import useExerciseTemplateStore from '@store/exerciseTemplates/useExerciseTemplateStore'
import {Text} from '@theme/Theme'
import {Subject} from 'rxjs'

import LoadingOverlay from '@components/LoadingOverlay'
import SecondaryButton from '@components/SecondaryButton'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/Screens'
import {
  CREATE_EXERCISE_BUTTON_TEXT,
  CREATE_TEMPLATE_BUTTON_TEXT,
  NO_EXERCISES_ADDED_TEXT,
  NO_TEMPLATES_ADDED_TEXT,
  TEMPLATES_HEADER,
  YOUR_EXERCISES_HEADER
} from '@constants/Strings'

import ExerciseListItem from './components/ExerciseListItem'
import ExerciseSearchBarButton from './components/SearchBarButton'
import TemplateListItem from './components/TemplateListItem'
import styles from './index.styled'
import {Navigation} from '../../navigation/types'

type SectionItem = Exercise | ExerciseTemplate

interface Section {
  title: string
  data: SectionItem[]
}

export const ExerciseScreenUpdateSubject$ = new Subject<{
  isUpdating: boolean
  updatePayload?: {
    success: boolean
    message: string
    message2?: string
  }
}>()

const AddExerciseScreen = () => {
  const {push} = useNavigation<Navigation>()

  const {templates} = useExerciseTemplateStore()
  const {exercises} = useExercisesStore()

  const sections: Section[] = [
    {
      title: TEMPLATES_HEADER,
      data: templates
    },
    {
      title: YOUR_EXERCISES_HEADER,
      data: exercises
    }
  ]

  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const sub = ExerciseScreenUpdateSubject$.subscribe({
      next: ({isUpdating, updatePayload}) => {
        setIsUpdating(isUpdating)
        if (updatePayload) {
          showToast(updatePayload.success ? 'success' : 'error', updatePayload.message, updatePayload?.message2)
        }
      }
    })

    return () => {
      sub.unsubscribe()
    }
  }, [])

  const renderHeader = (section: Section) => {
    const isEmpty = section.data.length === 0

    const button =
      section.title === YOUR_EXERCISES_HEADER ? (
        <SecondaryButton
          style={styles.createButton}
          label={CREATE_EXERCISE_BUTTON_TEXT}
          onPress={() => {
            push(Screens.CREATE_EXERCISE)
          }}
        />
      ) : (
        <SecondaryButton
          style={styles.createButton}
          label={CREATE_TEMPLATE_BUTTON_TEXT}
          onPress={() => {
            push(Screens.CREATE_TEMPLATE)
          }}
        />
      )

    const emptyText = isEmpty
      ? section.title === YOUR_EXERCISES_HEADER
        ? NO_EXERCISES_ADDED_TEXT
        : NO_TEMPLATES_ADDED_TEXT
      : undefined

    return (
      <>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>

          {button}
        </View>

        {emptyText && <Text style={styles.emptyText}>{emptyText}</Text>}
      </>
    )
  }

  const renderItem: SectionListRenderItem<SectionItem> = ({item}) => {
    return isExerciseObject(item) ? <ExerciseListItem exercise={item} /> : <TemplateListItem template={item} />
  }

  return (
    <>
      {isUpdating && <LoadingOverlay />}

      <SectionList<SectionItem, Section>
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        sections={sections}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={ExerciseSearchBarButton}
        ListFooterComponent={<View style={styles.listFooter} />}
        renderSectionHeader={({section}) => renderHeader(section)}
        renderItem={renderItem}
      />
    </>
  )
}

export default AddExerciseScreen
