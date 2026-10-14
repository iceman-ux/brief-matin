// Interrupteur 52 × 32 : accent quand il est actif, gris contrasté sinon.
// Il ne reçoit pas le toucher : c'est la ligne entière qui bascule.
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs } from 'react-native-svg';

import { useSkin } from '../skins';
import { sizes } from '../theme';
import { SvgGradient } from './Gradient';

export function Switch({ on }: { on: boolean }) {
  const skin = useSkin();
  const thumb = sizes.switchThumb;
  const left = on ? sizes.switchWidth - thumb - sizes.switchInset : sizes.switchInset;
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: on ? skin.accent : skin.switchOff, boxShadow: `inset 0 1px 2px ${skin.knobShade}` },
      ]}
    >
      <View style={[styles.thumb, { left, boxShadow: `0 1px 3px ${skin.shadow}` }]}>
        <Svg width={thumb} height={thumb}>
          <Defs>
            <SvgGradient id="switchThumb" css={skin.thumb} />
          </Defs>
          <Circle cx={thumb / 2} cy={thumb / 2} r={thumb / 2} fill="url(#switchThumb)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: sizes.switchWidth, height: sizes.switchHeight, borderRadius: sizes.switchHeight / 2, flexShrink: 0 },
  thumb: {
    position: 'absolute',
    top: sizes.switchInset,
    width: sizes.switchThumb,
    height: sizes.switchThumb,
    borderRadius: sizes.switchThumb / 2,
  },
});
