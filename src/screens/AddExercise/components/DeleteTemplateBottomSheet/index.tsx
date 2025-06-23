import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import ConfirmModal from '@components/dialog/ConfirmModal'
import {closeGlobalBottomSheet} from '@components/GlobalBottomSheet'
import {
  DELETE_BUTTON_TEXT,
  DELETE_TEMPLATE_MODAL_BODY,
  DELETE_TEMPLATE_MODAL_TITLE,
  stringWithParameters
} from '@constants/Strings'
import {Ionicons} from '@expo/vector-icons'
import {Text, useStyleTheme} from '@theme/Theme'

import {ExerciseTemplate} from '../../../../data/models/ExerciseTemplate'
import useExerciseTemplateStore from '../../../../store/exerciseTemplates/useExerciseTemplateStore'

import styles from './index.styled'

interface Props {
  readonly template: ExerciseTemplate
}

const DeleteTemplateBottomSheet = ({template}: Props) => {
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false)

  const {deleteTemplate} = useExerciseTemplateStore()

  const handleDeletePressed = () => {
    setIsConfirmModalVisible(true)
  }

  const closeSheet = () => {
    closeGlobalBottomSheet()
    setIsConfirmModalVisible(false)
  }

  const onConfirmedPressed = () => {
    deleteTemplate(template.name, template.id)
    closeSheet()
  }

  return (
    <>
      <ConfirmModal
        confirmationTitle={DELETE_TEMPLATE_MODAL_TITLE}
        confirmationBody={stringWithParameters(DELETE_TEMPLATE_MODAL_BODY, template.name)}
        isVisible={isConfirmModalVisible}
        onConfirmPressed={onConfirmedPressed}
        onCancel={closeSheet}
      />
      <View>
        <Text style={styles.title} numberOfLines={2}>
          {template.name}
        </Text>
        <Text style={styles.tagline} numberOfLines={1}>
          {template.tagline}
        </Text>
        <TouchableOpacity onPress={handleDeletePressed} activeOpacity={0.7} style={styles.deleteContainer}>
          <Ionicons name="trash-bin-outline" size={20} color={useStyleTheme().colors.error} />
          <Text style={styles.deleteText}>{DELETE_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

export default DeleteTemplateBottomSheet
