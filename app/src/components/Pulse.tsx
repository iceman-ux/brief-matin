// Point qui pulse : la ville d'un sujet, sur la carte et sur le globe.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useMotion } from '../motion';

const PULSE_MS = 2000;
// Le cercle d'onde part de 60 % du point et finit à trois fois sa taille.
const FROM = 0.6;
const TO = 3;
const START_OPACITY = 0.9;

type Props = { x: number; y: number; color: string; dot: number; wave: number; delay?: number };

export function Pulse({ x, y, color, dot, wave, delay = 0 }: Props) {
  const motion = useMotion();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: PULSE_MS, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
      t.setValue(0);
    };
  }, [motion, delay, t]);

  const circle = (size: number) => ({ width: size, height: size, borderRadius: size / 2, left: x - size / 2, top: y - size / 2 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {motion && (
        <Animated.View
          style={[
            styles.abs,
            circle(wave),
            {
              backgroundColor: color,
              opacity: t.interpolate({ inputRange: [0, 1], outputRange: [START_OPACITY, 0] }),
              transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [FROM, TO] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.abs, circle(dot), { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({ abs: { position: 'absolute' } });
