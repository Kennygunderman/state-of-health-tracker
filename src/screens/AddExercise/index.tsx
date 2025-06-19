import React from "react";
import useExercisesStore from "../../store/exercises/useExercisesStore";
import { SectionList, SectionListRenderItem, View } from "react-native";
import {
  CREATE_EXERCISE_BUTTON_TEXT,
  CREATE_TEMPLATE_BUTTON_TEXT,
  EXERCISES_HEADER,
  NO_EXERCISES_ADDED_TEXT,
  NO_TEMPLATES_ADDED_TEXT,
  TEMPLATES_HEADER,
} from "../../constants/Strings";
import {
  Exercise,
  isExerciseObject,
} from "../../data/models/Exercise";
import ExerciseListItem from "./components/ExerciseListItem";
import useExerciseTemplateStore from "../../store/exerciseTemplates/useExerciseTemplateStore";
import TemplateListItem from "./components/TemplateListItem";
import { ExerciseTemplate } from "../../data/models/ExerciseTemplate";
import styles from "./index.styled";
import SecondaryButton from "../../components/SecondaryButton";
import { Text } from "../../styles/Theme";
import SearchBarButton from "./components/SearchBarButton";
import { useNavigation } from "@react-navigation/native";
import { Navigation } from "../../navigation/types";
import Screens from "../../constants/Screens";

type SectionItem = Exercise | ExerciseTemplate;

interface Section {
  title: string;
  data: SectionItem[];
}

const AddExerciseScreen = () => {

  const { push } = useNavigation<Navigation>()

  const { templates } = useExerciseTemplateStore();
  const { exercises } = useExercisesStore();

  const sections: Section[] = [
    {
      title: TEMPLATES_HEADER,
      data: templates,
    },
    {
      title: EXERCISES_HEADER,
      data: exercises,
    },
  ];

  const renderHeader = (section: Section) => {
    const isEmpty = section.data.length === 0;

    const button =
      section.title === EXERCISES_HEADER ? (
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
          }}
        />
      );

    const emptyText =
      isEmpty
        ? section.title === EXERCISES_HEADER
          ? NO_EXERCISES_ADDED_TEXT
          : NO_TEMPLATES_ADDED_TEXT
        : undefined;

    return (
      <>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
          {button}
        </View>
        {emptyText && <Text style={styles.emptyText}>{emptyText}</Text>}
      </>
    );
  };

  const renderItem: SectionListRenderItem<SectionItem> = ({ item }) => {
    return isExerciseObject(item)
      ? <ExerciseListItem exercise={item}/>
      : <TemplateListItem template={item}/>
  };

  return (
    <SectionList<SectionItem, Section>
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      sections={sections}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={SearchBarButton}
      ListFooterComponent={<View style={styles.listFooter}/>}
      renderSectionHeader={({ section }) => renderHeader(section)}
      renderItem={renderItem}
    />
  );
};

export default AddExerciseScreen;
