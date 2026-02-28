import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';

const TOKEN_KEY = 'smartwishlist_token';
const CURRENCY_KEY = 'smartwishlist_currency';

export async function setToken(token) {
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    DeviceEventEmitter.emit('authChanged');
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
  DeviceEventEmitter.emit('authChanged');
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  DeviceEventEmitter.emit('authChanged');
}

export async function setPreferredCurrency(currency) {
  if (!currency) {
    await AsyncStorage.removeItem(CURRENCY_KEY);
    return;
  }
  await AsyncStorage.setItem(CURRENCY_KEY, String(currency).toUpperCase());
}

export async function getPreferredCurrency() {
  return AsyncStorage.getItem(CURRENCY_KEY);
}
