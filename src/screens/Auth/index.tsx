import { Alert, View, Image } from "react-native";

import { CommonActions, useNavigation } from "@react-navigation/native";
import { Navigation } from "../../navigation/types";
import useAuthStore from "../../store/auth/useAuthStore";
import { useEffect, useState } from "react";
import { AuthError } from "../../store/user/models/AuthError";
import { OKAY_BUTTON_TEXT } from "../../constants/Strings";
import { authStatus } from "../../data/types/authStatus";
import Screens from "../../constants/Screens";
import { Subject } from "rxjs";
import { useStyleTheme } from "../../styles/Theme";

import * as SplashScreen from "expo-splash-screen";

import styles from "./index.styled";

export const AuthErrorSubject$ = new Subject<AuthError>();

const RootAuthScreen = () => {
  const navigation = useNavigation<Navigation>();

  const theme = useStyleTheme();

  const [isRendered, setIsRendered] = useState(false);

  const {
    authStatus: status,
    initAuth
  } = useAuthStore();

  useEffect(() => {
    if (isRendered) {
      SplashScreen.hideAsync();
      initAuth();
    }
  }, [isRendered]);

  useEffect(() => {
    const subscription = AuthErrorSubject$.subscribe((error: AuthError) => {
      Alert.alert(
        error.errorPath,
        error.errorMessage,
        [
          {
            text: OKAY_BUTTON_TEXT,
          },
        ],
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === authStatus.Unauthed) {
      navigation.push('Auth', { screen: Screens.LOG_IN });
    } else if (status === authStatus.Authed) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      );
    }
  }, [status]);

  const onLayout = () => {
    if (!isRendered) {
      setIsRendered(true);
    }
  }

    return (
      <View
        onLayout={onLayout}
        style={[styles.container, {backgroundColor: theme.colors.background}]}
      >
        <Image
          source={require('../../assets/splash.png')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </View>
    );
}

export default RootAuthScreen;

