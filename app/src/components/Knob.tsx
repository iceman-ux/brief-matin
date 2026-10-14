// Bouton play : bouton rond métallique, anneau d'accent, halo. Sur l'écran
// Réveil, le halo « respire » (2,6 s).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs } from 'react-native-svg';

import { PauseIcon, PlayIcon } from '../icons';
import { useMotion } from '../motion';
import { useSkin } from '../skins';
import { sizes } from '../theme';
import { SvgGradient } from './Gradient';

const BREATH_MS = 1300;
const PRESSED_SCALE = 0.97;
// Le triangle de lecture est décalé à droite : son centre optique n'est pas
// celui de sa boîte.
const PLAY_NUDGE = 0.12;

type Props = {
  size: number;
  iconSize: number;
  playing: boolean;
  label: string;
  onPress: () => void;
  breathe?: boolean;
  disabled?: boolean;
};

export function Knob({ size, iconSize, playing, label, onPress, breathe = false, disabled = false }: Props) {
  const skin = useSkin();
  const motion = useMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const animate = breathe && motion;

  useEffect(() => {
    if (!animate) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BREATH_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: BREATH_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, breath]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={round}>
      {breathe && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, round, { boxShadow: `0 0 48px ${skin.accentGlow}`, opacity: breath }]}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          round,
          {
            boxShadow: `0 0 0 ${sizes.knobGap}px ${skin.bg}, 0 0 0 ${sizes.knobRing}px ${skin.accent}, 0 0 24px ${skin.accentGlow}`,
            transform: [{ scale: pressed ? PRESSED_SCALE : 1 }],
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="knobFace" css={skin.knob} />
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#knobFace)" />
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, round, { boxShadow: `inset 0 -3px 6px ${skin.knobShade}` }]} />
        <View style={[styles.icon, !playing && { paddingLeft: iconSize * PLAY_NUDGE }]}>
          {playing ? <PauseIcon size={iconSize} color={skin.onKnob} /> : <PlayIcon size={iconSize} color={skin.onKnob} />}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
