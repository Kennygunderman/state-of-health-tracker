import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import styles from './index.styled';
import { Text, useStyleTheme } from "../../../../styles/Theme";
import { SEARCH_EXERCISES_PLACEHOLDER } from "../../../../constants/Strings";

const SearchBarButton = () => {
  const theme = useStyleTheme();

  const onPress = () => {
    // todo: handle press
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

export default SearchBarButton;
