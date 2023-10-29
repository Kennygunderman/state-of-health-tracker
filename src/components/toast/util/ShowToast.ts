import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';

const TOAST_LENGTH = 3_000;
export const showToast = (type: 'success' | 'error', text1: string, text2?: string) => {
    Toast.show({
        type,
        text1,
        text2,
        visibilityTime: TOAST_LENGTH,
    });

    if (type === 'success') {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
        );
    } else {
        Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
        );
    }
};
