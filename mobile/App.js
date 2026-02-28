import React, {useEffect, useRef, useState} from 'react';
import {DeviceEventEmitter, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Svg, {Circle, Path} from 'react-native-svg';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {getNotifications} from './src/api';
import {getToken} from './src/storage';
import {getThemeMode} from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeIcon({color}) {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Path
        d="M3.5 10.2L12 3.5l8.5 6.7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.8 9.6V20h10.4V9.6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M10.8 20v-5.6a1.2 1.2 0 012.4 0V20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FriendsIcon({color}) {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Circle
        cx="9"
        cy="8"
        r="2.6"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Circle
        cx="15.6"
        cy="8.4"
        r="2.2"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Path
        d="M4.5 18.5c.7-2.6 2.5-4 4.5-4s3.8 1.4 4.5 4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12.6 18.5c.6-2 2-3.1 3.5-3.1 1.4 0 2.7 1 3.4 3.1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function BellIcon({color}) {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Path
        d="M7.4 9.8A4.6 4.6 0 0112 5.2a4.6 4.6 0 014.6 4.6v3.5l1.3 2.2H6.1l1.3-2.2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M10.3 17.3a1.7 1.7 0 003.4 0"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function GearIcon({color}) {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="6.4"
        stroke={color}
        strokeWidth={1.7}
        fill="none"
      />
      <Circle
        cx="12"
        cy="12"
        r="3.1"
        stroke={color}
        strokeWidth={1.7}
        fill="none"
      />
      <Path
        d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.7 5.7l1.6 1.6M16.7 16.7l1.6 1.6M5.7 18.3l1.6-1.6M16.7 7.3l1.6-1.6"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function AppTabs() {
  const [themeMode, setThemeMode] = useState('dark');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getThemeMode().then(setThemeMode);
    const sub = DeviceEventEmitter.addListener('themeChanged', setThemeMode);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshUnread() {
      const token = await getToken();
      if (!token || !active) {
        if (active) {
          setUnreadCount(0);
        }
        return;
      }
      const data = await getNotifications(token).catch(() => null);
      if (!active || !data) {
        return;
      }
      const unread = (data.notifications || []).filter(item => !item.is_read);
      setUnreadCount(unread.length);
    }

    refreshUnread();
    const intervalId = setInterval(refreshUnread, 15000);
    const sub = DeviceEventEmitter.addListener(
      'notificationsChanged',
      refreshUnread,
    );
    return () => {
      active = false;
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  const iconColorActive = themeMode === 'light' ? '#0f1014' : '#f5f7ff';
  const iconColorInactive = themeMode === 'light' ? '#4d5263' : '#8c94ab';

  function tabIcon(name, focused) {
    const color = focused ? iconColorActive : iconColorInactive;
    if (name === 'Home') {
      return <HomeIcon color={color} />;
    }
    if (name === 'Friends') {
      return <FriendsIcon color={color} />;
    }
    if (name === 'Notifications') {
      return <BellIcon color={color} />;
    }
    return <GearIcon color={color} />;
  }

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor:
              themeMode === 'light'
                ? 'rgba(238, 245, 255, 0.92)'
                : 'rgba(16, 23, 39, 0.88)',
            borderColor:
              themeMode === 'light'
                ? 'rgba(120, 150, 210, 0.35)'
                : 'rgba(140, 155, 195, 0.22)',
            borderTopColor:
              themeMode === 'light'
                ? 'rgba(120, 150, 210, 0.35)'
                : 'rgba(140, 155, 195, 0.22)',
          },
        ],
        tabBarItemStyle: [
          styles.tabBarItem,
          {
            backgroundColor:
              themeMode === 'light'
                ? 'rgba(79, 124, 255, 0.08)'
                : 'rgba(255, 255, 255, 0.1)',
            borderColor:
              themeMode === 'light'
                ? 'rgba(79, 124, 255, 0.24)'
                : 'rgba(255, 255, 255, 0.18)',
          },
        ],
        tabBarActiveBackgroundColor:
          themeMode === 'light'
            ? 'rgba(79, 124, 255, 0.28)'
            : 'rgba(150, 175, 255, 0.26)',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarIcon: ({focused}) => tabIcon(route.name, focused),
        tabBarBadge:
          route.name === 'Notifications' && unreadCount > 0
            ? unreadCount
            : undefined,
        tabBarBadgeStyle: {
          backgroundColor: '#ff3b30',
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          top: -2,
        },
      })}>
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
  const navRef = useRef(null);

  useEffect(() => {
    async function boot() {
      const token = await getToken();
      setIsAuthed(Boolean(token));
      setReady(true);
    }
    boot();

    const sub = DeviceEventEmitter.addListener('authChanged', async () => {
      const token = await getToken();
      setIsAuthed(Boolean(token));
    });

    return () => sub.remove();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
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

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 78,
    paddingTop: 9,
    paddingBottom: 9,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabBarItem: {
    borderRadius: 999,
    minWidth: 62,
    height: 56,
    alignSelf: 'center',
    marginHorizontal: 3,
    marginVertical: 2,
    borderWidth: 1,
  },
});
