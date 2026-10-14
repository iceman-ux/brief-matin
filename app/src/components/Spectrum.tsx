// Spectre segmenté (2 px pleins, 1 px vide), visible seulement pendant la
// lecture. Il ne mesure pas le son : il dit « ça joue », comme le voyant
// d'un appareil.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Rect } from 'react-native-svg';

import { useMotion } from '../motion';
import { useSkin } from '../skins';
import { sizes, spacing } from '../theme';
import { SvgGradient } from './Gradient';

// Hauteur masquée du haut de chaque barre, en fraction : la barre monte
// jusqu'à 1 − h, comme dans les maquettes.
const HEIGHTS = [0.3, 0.12, 0.22, 0.08, 0.18, 0.34, 0.14, 0.26, 0.1, 0.4, 0.2, 0.16, 0.28, 0.06];
const LOW = 0.1;
const BASE_MS = 350;
const STEP_MS = 130;
const STAGGER_MS = 90;

// Chaque barre a sa définition de dégradé : sur iPhone, un <Svg> ne voit pas
// les <Defs> d'un autre.
function Bar({ index, height }: { index: number; height: number }) {
  const skin = useSkin();
  const motion = useMotion();
  const gradientId = `seg${height}`;
  const value = useRef(new Animated.Value(1)).current;
  const top = 1 - HEIGHTS[index % HEIGHTS.length];

  useEffect(() => {
    if (!motion) {
      value.setValue(1);
      return;
    }
    const duration = BASE_MS + (index % 4) * STEP_MS;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const start = setTimeout(() => loop.start(), index * STAGGER_MS);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [motion, index, value]);

  // La fenêtre descend et son contenu remonte d'autant : la colonne reste
  // fixe, seul son haut est caché. Deux translations, animables nativement.
  const hidden = value.interpolate({ inputRange: [0, 1], outputRange: [(1 - LOW) * height, (1 - top) * height] });
  const counter = Animated.multiply(hidden, -1);
  const segments = Math.floor(height / (sizes.segment + sizes.segmentGap));

  return (
    <View style={[styles.bar, { height }]}>
      <Animated.View style={[styles.window, { transform: [{ translateY: hidden }] }]}>
        <Animated.View style={{ height, transform: [{ translateY: counter }] }}>
          <Svg width="100%" height={height}>
            <Defs>
              <SvgGradient id={gradientId} css={skin.seg} box={{ height }} />
            </Defs>
            {Array.from({ length: segments }, (_, k) => (
              <Rect
                key={k}
                x={0}
                y={height - (k + 1) * (sizes.segment + sizes.segmentGap) + sizes.segmentGap}
                width="100%"
                height={sizes.segment}
                fill={`url(#${gradientId})`}
              />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function Spectrum({ bars, height }: { bars: number; height: number }) {
  const list = useMemo(() => Array.from({ length: bars }, (_, i) => i), [bars]);
  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {list.map((i) => (
        <Bar key={i} index={i} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  bar: { flex: 1, overflow: 'hidden' },
  window: { flex: 1, overflow: 'hidden' },
});
