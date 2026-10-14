// Carte du sujet : contour du pays hachuré à la couleur du sujet, cadré et
// centré sur la ville, point qui pulse et nom de la ville. Ouvre la fiche.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { topicMapShape } from '../geo';
import { useSkin } from '../skins';
import type { Place } from '../topics';
import { layout, radii, sizes, spacing, type } from '../theme';
import { Label } from '../ui';
import { Pulse } from './Pulse';

const HATCH = 4.5;
const HATCH_WIDTH = 0.6;
const HATCH_OPACITY = 0.45;
const OUTLINE_WIDTH = 1;
const HALO_OPACITY = 0.14;
const PIN_DOT = 5.2;
const PIN_WAVE = 8;
// Nom de la ville juste à droite du point, centré sur lui.
const LABEL_GAP = 12;
const LABEL_HALF_HEIGHT = 14;

type Props = { place: Place; tint: string; index: number; onPress: () => void };

export function TopicMap({ place, tint, index, onPress }: Props) {
  const skin = useSkin();
  const [width, setWidth] = useState(0);
  const height = sizes.mapHeight;
  const shape = useMemo(
    () => (width > 0 ? topicMapShape(place.lon, place.lat, width, height) : null),
    [place.lon, place.lat, width, height],
  );
  const pin = shape ?? { x: width / 2, y: height / 2 };
  // Un identifiant par sujet : sur le web, les <pattern> sont globaux.
  const hatchId = `hatch${index}`;
  const haloId = `halo${index}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Fiche zone : ${place.country}`}
      onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: skin.surface, borderColor: skin.line },
        pressed && styles.pressed,
      ]}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={haloId} cx={0.5} cy={0.5} rx={0.7} ry={0.8}>
              <Stop offset={0} stopColor={tint} stopOpacity={HALO_OPACITY} />
              <Stop offset={0.7} stopColor={tint} stopOpacity={0} />
            </RadialGradient>
            <Pattern id={hatchId} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Line x1={0} y1={0} x2={0} y2={HATCH} stroke={tint} strokeWidth={HATCH_WIDTH} opacity={HATCH_OPACITY} />
            </Pattern>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${haloId})`} />
          {shape && (
            <Path d={shape.d} fill={`url(#${hatchId})`} stroke={tint} strokeWidth={OUTLINE_WIDTH} strokeLinejoin="round" />
          )}
        </Svg>
      )}
      {width > 0 && <Pulse x={pin.x} y={pin.y} color={skin.pin} dot={PIN_DOT} wave={PIN_WAVE} />}
      {width > 0 && (
        <View
          style={[
            styles.city,
            { left: pin.x + LABEL_GAP, top: pin.y - LABEL_HALF_HEIGHT, backgroundColor: skin.labelBg },
          ]}
        >
          <Text style={[type.cityLabel, { color: skin.text }]}>{place.city}</Text>
        </View>
      )}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: tint, boxShadow: `0 0 8px ${tint}` }]} />
        <Label color={skin.text}>{place.country}</Label>
      </View>
      <Label color={tint} style={styles.more}>
        Fiche ›
      </Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: sizes.mapHeight, borderRadius: radii.card, borderWidth: sizes.hairline, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.97 }] },
  legend: {
    position: 'absolute',
    left: layout.cardPadding,
    top: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ml,
  },
  legendDot: { width: sizes.dotLegend, height: sizes.dotLegend, borderRadius: sizes.dotLegend / 2 },
  city: {
    position: 'absolute',
    paddingHorizontal: layout.labelPad.horizontal,
    paddingVertical: layout.labelPad.vertical,
    borderRadius: radii.label,
  },
  more: { position: 'absolute', right: layout.cardPadding, bottom: spacing.xxl },
});
