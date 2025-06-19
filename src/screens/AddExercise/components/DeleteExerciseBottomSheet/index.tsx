import React, { useState } from "react";

import { Text, useStyleTheme } from "../../../../styles/Theme";
import styles from "./index.styled";
import { Exercise } from "../../../../data/models/Exercise";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import {
  DELETE_BUTTON_TEXT,
  DELETE_EXERCISE_MODAL_BODY,
  DELETE_EXERCISE_MODAL_TITLE,
  stringWithParameters
} from "../../../../constants/Strings";
import ConfirmModal from "../../../../components/dialog/ConfirmModal";
import { closeGlobalBottomSheet } from "../../../../components/GlobalBottomSheet";

interface Props {
  readonly exercise: Exercise;
}

const DeleteExerciseBottomSheet = ({ exercise }: Props) => {

  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);

  const handleDeletePressed = () => {
    setIsConfirmModalVisible(true);
  }

  const closeSheet = () => {
    closeGlobalBottomSheet()
    setIsConfirmModalVisible(false);
  }

  return (
    <>
      <ConfirmModal
        confirmationTitle={DELETE_EXERCISE_MODAL_TITLE}
        confirmationBody={stringWithParameters(DELETE_EXERCISE_MODAL_BODY, exercise.name)}
        isVisible={isConfirmModalVisible}
        onConfirmPressed={closeSheet}
        onCancel={closeSheet}
      />
      <Text style={styles.title}>{exercise.name}</Text>
      <TouchableOpacity
        onPress={handleDeletePressed}
        activeOpacity={0.7}
        style={styles.deleteContainer}
      >
        <Ionicons name="trash-bin-outline" size={20} color={useStyleTheme().colors.error}/>
        <Text style={styles.deleteText}>{DELETE_BUTTON_TEXT}</Text>
      </TouchableOpacity>
    </>
  )
}

export default DeleteExerciseBottomSheet
