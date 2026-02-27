import React, { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import WishlistScreen from "./src/screens/WishlistScreen";
import FriendsScreen from "./src/screens/FriendsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { getToken } from "./src/storage";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    async function boot() {
      const token = await getToken();
      setIsAuthed(Boolean(token));
      setReady(true);
    }
    boot();

    const sub = DeviceEventEmitter.addListener("authChanged", async () => {
      const token = await getToken();
      setIsAuthed(Boolean(token));
    });

    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthed ? (
          <>
            <Stack.Screen name="Tabs" component={AppTabs} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
