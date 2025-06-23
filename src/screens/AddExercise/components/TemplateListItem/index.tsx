import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import styles from './index.styled';
import { Text, useStyleTheme } from '../../../../styles/Theme';
import { ExerciseTemplate } from "../../../../data/models/ExerciseTemplate";
import useExerciseTemplateStore from "../../../../store/exerciseTemplates/useExerciseTemplateStore";
import { useNavigation } from "@react-navigation/native";
import { Navigation } from "../../../../navigation/types";
import Screens from "../../../../constants/Screens";
import { openGlobalBottomSheet } from "../../../../components/GlobalBottomSheet";
import DeleteTemplateBottomSheet from "../DeleteTemplateBottomSheet";

interface Props {
  template: ExerciseTemplate;
}

const TemplateListItem = ({ template }: Props) => {
  const theme = useStyleTheme();

  const { push } =useNavigation<Navigation>()
  const { setSelectedTemplate } = useExerciseTemplateStore();

  const onPress = () => {
    setSelectedTemplate(template);
    push(Screens.WORKOUT_TEMPLATE_DETAIL)
  };

  const onLongPress = () => {
    openGlobalBottomSheet(<DeleteTemplateBottomSheet template={template} />)
  }

  return (
    <TouchableOpacity
      activeOpacity={0.5}
      delayPressIn={50}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      >
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
  );
};

export default TemplateListItem;
