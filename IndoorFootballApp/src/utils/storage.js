// src/utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// store string token (if token is object, stringify before saving)
export const saveToken = async token => {
  try {
    const value = typeof token === 'string' ? token : JSON.stringify(token);
    await AsyncStorage.setItem('jwt', value);
  } catch (err) {
    console.error('saveToken error', err);
  }
};

export const getToken = async () => {
  try {
    const value = await AsyncStorage.getItem('jwt');
    return value;
  } catch (err) {
    console.error('getToken error', err);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem('jwt');
  } catch (err) {
    console.error('removeToken error', err);
  }
};
