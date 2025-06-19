import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'user_id';

export const storeUserId = async (userId: string): Promise<void> => {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
};

export const removeUserId = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_ID_KEY);
};

export const getUserId = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(USER_ID_KEY);
};
