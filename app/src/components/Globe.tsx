// Globe filaire de Bienvenue, avec les villes des sujets du jour quand le
// flux les donne. Il tourne lentement, sauf si les animations sont coupées.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { globeShape } from '../geo';
import { useMotion } from '../motion';
import { tintOf, useSkin } from '../skins';
import type { Place } from '../topics';
import { Pulse } from './Pulse';

// Vu d'Europe quand aucun lieu n'est connu.
const DEFAULT_CENTER: [number, number] = [15, 30];
const TURN_DEG_PER_S = 6;
const FRAME_MS = 50;
const LINE_WIDTH = 0.6;
const LINE_OPACITY = 0.45;
const DOT = 4;
const WAVE = 6;
const PULSE_STAGGER_MS = 500;

function centerOf(places: Place[]): [number, number] {
  if (places.length === 0) return DEFAULT_CENTER;
  const lon = places.reduce((sum, p) => sum + p.lon, 0) / places.length;
  const lat = places.reduce((sum, p) => sum + p.lat, 0) / places.length;
  return [lon, lat];
}

export function Globe({ size, places }: { size: number; places: (Place | undefined)[] }) {
  const skin = useSkin();
  const motion = useMotion();
  const known = places.filter((p): p is Place => p !== undefined);
  const start = centerOf(known);
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!motion) {
      setTurn(0);
      return;
    }
    const began = Date.now();
    const timer = setInterval(() => setTurn(((Date.now() - began) / 1000) * TURN_DEG_PER_S), FRAME_MS);
    return () => clearInterval(timer);
  }, [motion]);

  const center: [number, number] = [start[0] - turn, start[1]];
  const points = places.map((p) => (p ? ([p.lon, p.lat] as [number, number]) : ([0, 0] as [number, number])));
  // Recalculé à chaque image : un graticule de 10° et une poignée de points, c'est peu.
  const shape = globeShape(size, center, points);

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="globeFill" cx={0.4} cy={0.34} r={0.75}>
            <Stop offset={0} stopColor={skin.surface2} />
            <Stop offset={1} stopColor={skin.bg} />
          </RadialGradient>
        </Defs>
        <Path d={shape.sphere} fill="url(#globeFill)" />
        <Path d={shape.graticule} fill="none" stroke={skin.text2} strokeWidth={LINE_WIDTH} opacity={LINE_OPACITY} />
        <Path d={shape.sphere} fill="none" stroke={skin.text2} strokeWidth={LINE_WIDTH} opacity={LINE_OPACITY} />
      </Svg>
      {shape.points.map((p, i) =>
        p && places[i] ? (
          <Pulse key={i} x={p.x} y={p.y} color={tintOf(skin, i)} dot={DOT} wave={WAVE} delay={i * PULSE_STAGGER_MS} />
        ) : null,
      )}
    </View>
  );
}
