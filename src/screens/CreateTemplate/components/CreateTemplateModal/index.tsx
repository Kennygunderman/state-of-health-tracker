import React, {useState} from 'react'

import BaseInputModalProps from '@components/dialog/BaseInputModalProps'
import InputModal from '@components/dialog/InputModal'
import {Exercise} from '@data/models/Exercise'
import {
  TEMPLATE_MODAL_BUTTON_TEXT,
  TEMPLATE_MODAL_ERROR_TEXT,
  TEMPLATE_MODAL_PLACEHOLDER,
  TEMPLATE_MODAL_TITLE
} from '@constants/Strings'

interface Props extends BaseInputModalProps {
  exercises: Exercise[]
  handleCreate: (name: string, tagline: string) => void
}

const CreateTemplateModal = (props: Props) => {
  const {exercises, isVisible, onDismissed, handleCreate} = props

  const [name, setName] = useState('')
  const [showError, setShowError] = useState(false)

  const templateTagline = exercises.map(e => e.name).join(', ')

  const onCreatePressed = () => {
    if (name.length === 0) {
      setShowError(true)
      return
    }

    handleCreate(name, templateTagline)
  }

  return (
    <InputModal
      placeholder={TEMPLATE_MODAL_PLACEHOLDER}
      title={TEMPLATE_MODAL_TITLE}
      subtitle={templateTagline}
      value={name}
      isVisible={isVisible}
      onCancel={() => {
        setShowError(false)
        onDismissed()
      }}
      buttonText={TEMPLATE_MODAL_BUTTON_TEXT}
      onChangeText={text => {
        setShowError(false)
        setName(text)
      }}
      showError={showError}
      errorMessage={TEMPLATE_MODAL_ERROR_TEXT}
      onButtonPressed={onCreatePressed}
    />
  )
}

export default CreateTemplateModal
