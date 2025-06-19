import { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type RootStackParamList = {
  'Add Exercise': undefined;
  'Previous Daily Exercise Entries': undefined;
  'Workout Template': undefined;
  'Create Exercise': undefined;
  'Create Template': undefined;
  'Search Exercises': undefined;
};

export type Navigation = NativeStackNavigationProp<RootStackParamList>;
