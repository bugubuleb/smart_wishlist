import React, {useEffect, useState} from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {getPalette, getThemeMode} from '../theme';

export default function Screen({children, style}) {
  const [mode, setMode] = useState('dark');
  const driftA = React.useRef(new Animated.Value(0)).current;
  const driftB = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getThemeMode().then(setMode);
    const sub = DeviceEventEmitter.addListener('themeChanged', setMode);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(driftA, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftA, {
          toValue: 0,
          duration: 7600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(driftB, {
          toValue: 1,
          duration: 9100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftB, {
          toValue: 0,
          duration: 6900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [driftA, driftB]);

  const palette = getPalette(mode);
  const dots = React.useMemo(() => {
    const count = mode === 'dark' ? 44 : 32;
    return Array.from({length: count}, (_, i) => ({
      key: `dot-${i}`,
      top: `${Math.random() * 96}%`,
      left: `${Math.random() * 96}%`,
      size: 2 + (i % 3),
      opacity: 0.2 + Math.random() * 0.45,
      ampX: 2 + Math.random() * 9,
      ampY: 2 + Math.random() * 10,
      dirX: i % 2 === 0 ? 1 : -1,
      dirY: i % 3 === 0 ? -1 : 1,
    }));
  }, [mode]);

  return (
    <SafeAreaView
      style={[styles.base, {backgroundColor: palette.colors.bg}, style]}>
      <StatusBar
        barStyle={mode === 'light' ? 'dark-content' : 'light-content'}
      />
      <View style={styles.bgLayer} pointerEvents="none">
        {dots.map(dot => (
          <Animated.View
            key={dot.key}
            style={{
              ...styles.dotBase,
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size,
              top: dot.top,
              left: dot.left,
              backgroundColor: palette.colors.dot,
              opacity: dot.opacity,
              transform: [
                {
                  translateX: driftA.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-dot.ampX * dot.dirX, dot.ampX * dot.dirX],
                  }),
                },
                {
                  translateY: driftB.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-dot.ampY * dot.dirY, dot.ampY * dot.dirY],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  dotBase: {
    position: 'absolute',
  },
});
