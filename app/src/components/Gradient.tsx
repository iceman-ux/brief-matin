// Dégradés des skins (chaînes CSS) rendus en React Native : vue à fond
// dégradé par expo-linear-gradient, ou définition SVG pour react-native-svg.
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient as SvgLinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { linearPoints, parseGradient } from '../skins/gradient';

type Colors = readonly [string, string, ...string[]];

/** Vue à fond dégradé linéaire (rim, glass). */
export function GradientView(props: { css: string; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const gradient = useMemo(() => parseGradient(props.css), [props.css]);
  const stops = gradient.stops;
  const points = linearPoints(gradient.kind === 'linear' ? gradient.angle : 180);
  return (
    <LinearGradient
      colors={stops.map((s) => s.color) as unknown as Colors}
      locations={stops.map((s) => s.offset) as unknown as readonly [number, number, ...number[]]}
      start={points.start}
      end={points.end}
      style={props.style}
    >
      {props.children}
    </LinearGradient>
  );
}

/**
 * Dégradé SVG, à placer dans <Defs>. Linéaire : `box` donne la hauteur en
 * unités de l'utilisateur, pour que les arrêts nets du spectre tombent au
 * même endroit sur toutes les barres.
 */
export function SvgGradient(props: { id: string; css: string; box?: { height: number } }) {
  const gradient = useMemo(() => parseGradient(props.css), [props.css]);
  const stops = gradient.stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} />);
  if (gradient.kind === 'radial') {
    return (
      <RadialGradient id={props.id} cx={gradient.cx} cy={gradient.cy} fx={gradient.cx} fy={gradient.cy} r={gradient.r}>
        {stops}
      </RadialGradient>
    );
  }
  const { start, end } = linearPoints(gradient.angle);
  if (props.box) {
    const h = props.box.height;
    return (
      <SvgLinearGradient id={props.id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={start.y * h} y2={end.y * h}>
        {stops}
      </SvgLinearGradient>
    );
  }
  return (
    <SvgLinearGradient id={props.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
      {stops}
    </SvgLinearGradient>
  );
}
