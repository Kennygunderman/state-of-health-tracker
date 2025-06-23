import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {useNavigation} from '@react-navigation/native'
import {Text, useStyleTheme} from '@theme/Theme'

import Screens from '@constants/Screens'
import {SEARCH_EXERCISES_PLACEHOLDER} from '@constants/Strings'

import styles from './index.styled'
import {Navigation} from '../../../../navigation/types'

const ExerciseSearchBarButton = () => {
  const {navigate} = useNavigation<Navigation>()
  const theme = useStyleTheme()

  const onPress = () => {
    navigate(Screens.SEARCH_EXERCISES)
  }

  return (
    <>
      <View style={[styles.searchBarBackground, {backgroundColor: theme.colors.secondary}]} />

      <View style={[styles.container, {backgroundColor: theme.colors.secondary}]}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.innerContainer, {backgroundColor: theme.colors.background}]}
          onPress={onPress}>
          <Ionicons style={styles.icon} name="search" size={20} color={theme.colors.secondary} />

          <Text style={[styles.placeholder, {color: theme.colors.tertiary}]} numberOfLines={1}>
            {SEARCH_EXERCISES_PLACEHOLDER}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

export default ExerciseSearchBarButton
