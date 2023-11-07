import crashlytics from '@react-native-firebase/crashlytics';

export default class CrashUtility {
    public static recordError(error: Error) {
        crashlytics().recordError(error);
    }
}
