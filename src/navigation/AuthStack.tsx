import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LogInScreen from '../screens/Auth/LogInScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import { TouchableOpacity } from 'react-native';
import { useStyleTheme } from '../styles/Theme';
import { Ionicons } from '@expo/vector-icons';

import Screens from '../constants/Screens';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  const theme = useStyleTheme();

  const closeButton = (onPress: () => void) => (
    <TouchableOpacity onPress={onPress}>
      <Ionicons name="close" size={24} color={theme.colors.white}/>
    </TouchableOpacity>
  );

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        presentation: 'modal',
        headerLeft: () => closeButton(() => navigation.goBack()),
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.white,
        headerShadowVisible: false,
      })}
    >
      <Stack.Screen name={Screens.LOG_IN} component={LogInScreen}/>
      <Stack.Screen name={Screens.REGISTER} component={RegisterScreen}/>
    </Stack.Navigator>
  );
};

export default AuthStack;
