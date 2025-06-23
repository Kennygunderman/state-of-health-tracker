import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  'Log In': undefined;
  'Register': undefined;
};

export type RootStackParamList = {
  'Add Exercise': undefined;
  'Previous Daily Exercise Entries': undefined;
  'Workout Template': undefined;
  'Create Exercise': undefined;
  'Create Template': undefined;
  'Search Exercises': undefined;
  'Home': undefined;
  'Auth': NavigatorScreenParams<AuthStackParamList>;
};

export type Navigation = NativeStackNavigationProp<RootStackParamList>;
