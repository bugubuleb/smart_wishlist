import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "smartwishlist_token";

export async function setToken(token) {
  if (!token) return AsyncStorage.removeItem(TOKEN_KEY);
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  return AsyncStorage.removeItem(TOKEN_KEY);
}
