import React from 'react';
import AuthForm from '../../components/AuthForm';
import { Text } from "../../styles/Theme";
import { SafeAreaView, View } from "react-native";
import { AUTH_TO_CONTINUE_DESC } from "../../constants/Strings";

import styles from './index.styled';
import HorizontalDivider from "../../components/HorizontalDivider";

const LogInScreen = () => (
  <SafeAreaView style={{height: '100%', padding: 20, justifyContent: 'space-between'}}>
    <AuthForm
      authType="log-in"
    />
    <View style={styles.textContainer}>
      <HorizontalDivider />
      <Text style={styles.text}>{AUTH_TO_CONTINUE_DESC}</Text>
    </View>
  </SafeAreaView>

);

export default LogInScreen;
