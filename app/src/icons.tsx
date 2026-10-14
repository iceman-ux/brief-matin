// Icônes des maquettes V11. Couleur et taille viennent toujours de l'appelant.
import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { size: number; color: string };

const STROKE_BACK = 2.4;
const STROKE_BELL = 2.2;

export function ChevronLeftIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE_BACK} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function BellIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE_BELL} strokeLinecap="round">
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  );
}

export function PlayIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 4.5v15l13-7.5z" />
    </Svg>
  );
}

/** Petit triangle de « Écouter ce sujet ». */
export function PlaySmallIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M5 3v18l16-9z" />
    </Svg>
  );
}

export function PauseIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={6} y={4.5} width={4.2} height={15} rx={1} />
      <Rect x={13.8} y={4.5} width={4.2} height={15} rx={1} />
    </Svg>
  );
}

export function PreviousIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={4} y={5} width={2.6} height={14} rx={1} />
      <Path d="M20 5v14L8 12z" />
    </Svg>
  );
}

export function NextIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={17.4} y={5} width={2.6} height={14} rx={1} />
      <Path d="M4 5v14l12-7z" />
    </Svg>
  );
}
