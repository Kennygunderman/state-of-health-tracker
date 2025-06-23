import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import styles from './index.styled';
import { Text, useStyleTheme } from "../../../../styles/Theme";
import { SEARCH_EXERCISES_PLACEHOLDER } from "../../../../constants/Strings";
import { useNavigation } from "@react-navigation/native";
import { Navigation } from "../../../../navigation/types";
import Screens from "../../../../constants/Screens";

const ExerciseSearchBarButton = () => {

  const { navigate } = useNavigation<Navigation>()
  const theme = useStyleTheme();

  const onPress = () => {
    navigate(Screens.SEARCH_EXERCISES)
  }

  return (
    <>
      <View style={[styles.searchBarBackground, { backgroundColor: theme.colors.secondary }]}/>
      <View style={[styles.container, { backgroundColor: theme.colors.secondary }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.innerContainer, { backgroundColor: theme.colors.background }]}
          onPress={onPress}
        >
          <Ionicons
            style={styles.icon}
            name="search"
            size={20}
            color={theme.colors.secondary}
          />
          <Text style={[styles.placeholder, { color: theme.colors.tertiary }]} numberOfLines={1}>
            {SEARCH_EXERCISES_PLACEHOLDER}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default ExerciseSearchBarButton;
