import { useNavigation } from "@react-navigation/native";
import useExercisesStore from "../../store/exercises/useExercisesStore";
import React, { useEffect } from "react";
import { SectionList, SectionListRenderItem, View } from "react-native";
import Spacing from "../../constants/Spacing";
import { EXERCISES_HEADER } from "../../constants/Strings";
import { Exercise, instanceOfExercise } from "../../store/exercises/models/Exercise";
import { WorkoutTemplate } from "../../store/exercises/models/WorkoutTemplate";
import ExerciseListItem from "./components/ExerciseListItem";

type SectionItem = Exercise | WorkoutTemplate;

interface Section {
  title: string;
  data: SectionItem[];
}

const AddExerciseScreen = () => {
  const { navigate } = useNavigation();

  const {
    exercises,
    fetchExercises
  } = useExercisesStore()

  useEffect(() => {
    if (exercises.length === 0) fetchExercises()
  }, []);

  const sections: Section[] = [
    {
      title: EXERCISES_HEADER,
      data: exercises,
    },
  ];

  const renderItem: SectionListRenderItem<SectionItem> = ({ item }) => {
    return instanceOfExercise(item) ? <ExerciseListItem exercise={item} /> : null
  };

  return (
    <SectionList
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      sections={sections}
      stickySectionHeadersEnabled={true}
      // ListHeaderComponent={renderSearchBar()}
      ListFooterComponent={<View style={{ marginBottom: Spacing.X_LARGE }}/>}
      // renderSectionHeader={({ section }) => renderSectionItemHeader(section)}
      renderItem={renderItem}
    />
  )

}

export default AddExerciseScreen
