import React from 'react'

import {SafeAreaView, View} from 'react-native'

import AuthForm from '@components/AuthForm'
import HorizontalDivider from '@components/HorizontalDivider'
import {AUTH_TO_CONTINUE_DESC} from '@constants/Strings'
import {Text} from '@theme/Theme'

import styles from './index.styled'

const LogInScreen = () => (
  <SafeAreaView style={styles.container}>
    <AuthForm authType="log-in" />
    <View style={styles.textContainer}>
      <HorizontalDivider />
      <Text style={styles.text}>{AUTH_TO_CONTINUE_DESC}</Text>
    </View>
  </SafeAreaView>
)

export default LogInScreen
