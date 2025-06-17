import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import styles from './index.styled';
import { Text, useStyleTheme } from "../../../../styles/Theme";
import { Exercise } from "../../../../store/exercises/models/Exercise";
import ExerciseTypeChip from "../ExerciseTypeChip";
import { openGlobalBottomSheet } from "../../../../components/GlobalBottomSheet";
import DeleteExerciseBottomSheet from "../DeleteExerciseBottomSheet";

interface Props {
  exercise: Exercise;
}

const ExerciseListItem = ({
 exercise
}: Props) => {
  const theme = useStyleTheme();

  const onLongPress = () => {
    openGlobalBottomSheet(<DeleteExerciseBottomSheet exercise={exercise} />);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.5}
      delayPressIn={50}
      onLongPress={onLongPress}
    >
      <View style={
        [
          styles.container,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border
          }
        ]
      }>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{exercise.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{exercise.exerciseBodyPart}</Text>
        </View>
        {<View style={styles.chipContainer}>{<ExerciseTypeChip exerciseType={exercise.exerciseType}/>}</View>}
      </View>
    </TouchableOpacity>
  );
};

export default ExerciseListItem;
