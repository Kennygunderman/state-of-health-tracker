import { Alert, View, Image } from "react-native";

import { CommonActions, useNavigation } from "@react-navigation/native";
import { Navigation } from "../../navigation/types";
import useAuthStore from "../../store/auth/useAuthStore";
import { useEffect, useState } from "react";
import { AuthError } from "../../store/user/models/AuthError";
import { OKAY_BUTTON_TEXT } from "../../constants/Strings";
import { AuthStatus, authStatus } from "../../data/types/authStatus";
import Screens from "../../constants/Screens";
import { Subject } from "rxjs";
import { useStyleTheme } from "../../styles/Theme";

import * as SplashScreen from "expo-splash-screen";

import styles from "./index.styled";

export const AuthSubject$ = new Subject<AuthStatus>();

const RootAuthScreen = () => {
  const navigation = useNavigation<Navigation>();

  const theme = useStyleTheme();

  const [isRendered, setIsRendered] = useState(false);

  const { initAuth } = useAuthStore();

  useEffect(() => {
    if (isRendered) {
      SplashScreen.hideAsync();
      initAuth();
    }
  }, [isRendered]);

  useEffect(() => {
    const subscription = AuthSubject$.subscribe({
      next: (status: AuthStatus) => {
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
      },
      error: (error: AuthError) => {
        Alert.alert(
          error.errorPath,
          error.errorMessage,
          [
            {
              text: OKAY_BUTTON_TEXT,
            },
          ],
        );
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onLayout = () => {
    if (!isRendered) {
      setIsRendered(true);
    }
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
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

