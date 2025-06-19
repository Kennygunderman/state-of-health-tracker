import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import styles from './index.styled';
import { Text, useStyleTheme } from '../../../../styles/Theme';
import { ExerciseTemplate } from "../../../../data/models/ExerciseTemplate";

interface Props {
  template: ExerciseTemplate;
}

const TemplateListItem = ({ template }: Props) => {
  const theme = useStyleTheme();

  const onPress = () => {
    // TODO: Implement template selection logic
    console.log(`Pressed template: ${template.name}`);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.5}
      delayPressIn={50}
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
