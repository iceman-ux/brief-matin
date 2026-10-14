// Barre de progression de l'objet lecteur : piste, remplissage d'accent, et
// un point par sujet à sa position de début, quand les débuts sont connus.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tintOf, useSkin } from '../skins';
import { sizes } from '../theme';

export type Mark = { at: number; label: string; active: boolean; onPress: () => void };

type Props = {
  /** 0 à 1. */
  progress: number;
  duration: number;
  current: number;
  marks: Mark[];
  onSeek?: (fraction: number) => void;
};

// Zone tactile de 44 px autour d'un bloc de 16 px.
const HIT = (sizes.touch - sizes.progressBlock) / 2;

export function ProgressBar({ progress, duration, current, marks, onSeek }: Props) {
  const skin = useSkin();
  const [width, setWidth] = useState(0);
  const pct = `${Math.max(0, Math.min(1, progress)) * 100}%` as const;
  return (
    <View style={styles.block} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Position dans le brief"
        accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(current) }}
        disabled={!onSeek}
        hitSlop={{ top: HIT, bottom: HIT }}
        onPress={(e) => onSeek && width > 0 && onSeek(e.nativeEvent.locationX / width)}
        style={StyleSheet.absoluteFill}
      >
        <View style={[styles.track, styles.full, { backgroundColor: skin.track }]} />
        <View style={[styles.track, { width: pct, backgroundColor: skin.accent, boxShadow: `0 0 6px ${skin.accentGlow}` }]} />
      </Pressable>
      {marks.map((mark, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={mark.label}
          accessibilityState={{ selected: mark.active }}
          onPress={mark.onPress}
          style={[styles.mark, { left: `${mark.at * 100}%` }]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: mark.active ? tintOf(skin, i) : skin.dotOff,
                boxShadow: `0 0 0 ${sizes.dotRing}px ${skin.glassBase}`,
              },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { height: sizes.progressBlock },
  track: {
    position: 'absolute',
    left: 0,
    top: (sizes.progressBlock - sizes.progress) / 2,
    height: sizes.progress,
    borderRadius: sizes.progress / 2,
  },
  full: { right: 0 },
  mark: {
    position: 'absolute',
    top: (sizes.progressBlock - sizes.mark) / 2,
    width: sizes.mark,
    height: sizes.mark,
    marginLeft: -sizes.mark / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: sizes.dot, height: sizes.dot, borderRadius: sizes.dot / 2 },
});
