import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {ExerciseTemplate} from '@data/models/ExerciseTemplate'
import {useNavigation} from '@react-navigation/native'
import useExerciseTemplateStore from '@store/exerciseTemplates/useExerciseTemplateStore'
import {Text, useStyleTheme} from '@theme/Theme'

import DeleteTemplateBottomSheet from '@screens/AddExercise/components/DeleteTemplateBottomSheet'

import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'

import Screens from '@constants/Screens'

import styles from './index.styled'
import {Navigation} from '../../../../navigation/types'

interface Props {
  template: ExerciseTemplate
}

const TemplateListItem = ({template}: Props) => {
  const theme = useStyleTheme()

  const {push} = useNavigation<Navigation>()
  const {setSelectedTemplate} = useExerciseTemplateStore()

  const onPress = () => {
    setSelectedTemplate(template)
    push(Screens.WORKOUT_TEMPLATE_DETAIL)
  }

  const onLongPress = () => {
    openGlobalBottomSheet(<DeleteTemplateBottomSheet template={template} />)
  }

  return (
    <TouchableOpacity activeOpacity={0.5} delayPressIn={50} onLongPress={onLongPress} onPress={onPress}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border
          }
        ]}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {template.name}
          </Text>

          <Text style={styles.subtitle} numberOfLines={1}>
            {template.tagline}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default TemplateListItem
