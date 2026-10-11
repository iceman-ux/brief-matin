// L'illustration de l'app, à un seul endroit pour pouvoir la remplacer.
// Aujourd'hui : le soleil Art déco des maquettes (rayons dorés, disque
// bordeaux, disque ambre), levé au milieu du bord bas.
//
// Les écrans ne choisissent qu'un emplacement et une largeur ; la hauteur et
// le dessin propres à chaque emplacement sont décidés ici.
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import { colors, sizes } from './theme';

export type IllustrationVariant = 'hero' | 'card' | 'cover';

type Spec = {
  height: number;
  /** Rayons des deux disques, en part de la hauteur. */
  outer: number;
  inner: number;
  /** Angles des rayons au-dessus de l'horizon, pour une moitié (l'autre est symétrique). */
  rays: number[];
  rayOpacity: number;
  /** Bande sombre en bas, qui pose le soleil sur l'horizon. */
  horizon: boolean;
  /** Étoiles en part de la largeur et de la hauteur. */
  stars: { x: number; y: number; r: number }[];
};

// Proportions relevées sur les maquettes : Bienvenue (390 × 330), Accueil
// (342 × 168), Lecture (342 × 300).
const SPECS: Record<IllustrationVariant, Spec> = {
  hero: {
    height: sizes.illustrationHero,
    outer: 118 / 330,
    inner: 92 / 330,
    rays: [27, 47, 58, 68, 78.5, 90],
    rayOpacity: 0.5,
    horizon: false,
    stars: [
      { x: 70 / 390, y: 70 / 330, r: 1.6 },
      { x: 320 / 390, y: 96 / 330, r: 1.2 },
      { x: 290 / 390, y: 40 / 330, r: 1.8 },
      { x: 40 / 390, y: 160 / 330, r: 1 },
    ],
  },
  card: {
    height: sizes.illustrationCard,
    outer: 62 / 168,
    inner: 46 / 168,
    rays: [18.7, 36.8, 50, 61.6, 75.6, 90],
    rayOpacity: 0.55,
    horizon: true,
    stars: [],
  },
  cover: {
    height: sizes.illustrationCover,
    outer: 112 / 300,
    inner: 86 / 300,
    rays: [27.8, 48, 59.5, 69, 79, 90],
    rayOpacity: 0.55,
    horizon: false,
    stars: [],
  },
};

const RAY_WIDTH = 1.2;
const HORIZON_HEIGHT = 18;
const HORIZON_OPACITY = 0.35;

export function illustrationHeight(variant: IllustrationVariant): number {
  return SPECS[variant].height;
}

export function Illustration({ variant, width }: { variant: IllustrationVariant; width: number }) {
  const spec = SPECS[variant];
  const height = spec.height;
  const cx = width / 2;
  // Assez long pour sortir du cadre dans tous les cas : le dessin est rogné.
  const length = Math.hypot(width, height);
  const rays = spec.rays.flatMap((deg) => {
    const rad = (deg * Math.PI) / 180;
    const dx = Math.cos(rad) * length;
    const dy = Math.sin(rad) * length;
    return deg === 90 ? [{ dx: 0, dy }] : [{ dx: -dx, dy }, { dx, dy }];
  });
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} pointerEvents="none">
      <G stroke={colors.ornament} strokeWidth={RAY_WIDTH} opacity={spec.rayOpacity}>
        {rays.map((r, i) => (
          <Line key={i} x1={cx} y1={height} x2={cx + r.dx} y2={height - r.dy} />
        ))}
      </G>
      <Circle cx={cx} cy={height} r={spec.outer * height} fill={colors.deep} />
      <Circle cx={cx} cy={height} r={spec.inner * height} fill={colors.accent} />
      {spec.horizon && (
        <Rect
          x={0}
          y={height - HORIZON_HEIGHT}
          width={width}
          height={HORIZON_HEIGHT}
          fill={colors.background}
          opacity={HORIZON_OPACITY}
        />
      )}
      {spec.stars.map((s, i) => (
        <Circle key={`s${i}`} cx={s.x * width} cy={s.y * height} r={s.r} fill={colors.text} />
      ))}
    </Svg>
  );
}
