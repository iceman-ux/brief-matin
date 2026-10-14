// Objet lecteur : cadre chromé (rim) autour d'un écran (glass). Le contenu
// dépend de l'écran : temps, réglage de l'heure, heure du réveil.
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSkin } from '../skins';
import { radii, sizes } from '../theme';
import { GradientView } from './Gradient';

// Halo de l'écran LCD allumé, très léger : 8 % de la couleur LCD.
const GLOW_OPACITY = 0.08;

type Props = {
  children: ReactNode;
  /** Marges intérieures de l'écran. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Halo LCD : centre en fractions de l'écran (Réveil, Lecteur). */
  glow?: { x: number; y: number };
};

export function Device({ children, contentStyle, glow }: Props) {
  const skin = useSkin();
  return (
    <View style={[styles.frame, { boxShadow: `0 18px 40px ${skin.shadow}` }]}>
      <GradientView css={skin.rim} style={styles.rim}>
        <View style={styles.glass}>
          <GradientView css={skin.glass} style={StyleSheet.absoluteFill} />
          {glow && (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id="deviceGlow" cx={glow.x} cy={glow.y} r={0.7}>
                  <Stop offset={0} stopColor={skin.lcd} stopOpacity={GLOW_OPACITY} />
                  <Stop offset={1} stopColor={skin.lcd} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#deviceGlow)" />
            </Svg>
          )}
          {/* Reflet du haut et ombre intérieure : l'écran est enfoncé dans le cadre. */}
          <View
            pointerEvents="none"
            style={[styles.inset, { boxShadow: `inset 0 1px 0 ${skin.glassHi}, inset 0 12px 30px ${skin.glassIn}` }]}
          />
          <View style={contentStyle}>{children}</View>
        </View>
      </GradientView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.device },
  rim: { borderRadius: radii.device, padding: sizes.rimWidth },
  glass: { borderRadius: radii.glass, overflow: 'hidden' },
  inset: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radii.glass },
});
