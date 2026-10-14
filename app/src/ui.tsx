// Éléments partagés par les écrans. Couleurs et matières viennent du skin,
// tailles et polices de theme.ts.
import { type ReactNode, useState } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Text as SvgText } from 'react-native-svg';

import { ALARM_STEP_MINUTES } from '../constants';
import { ALARM_SIMULATED } from './alarm';
import { Device } from './components/Device';
import { SvgGradient } from './components/Gradient';
import { type AlarmSchedule, WEEK_ORDER, dayLetter, dayName, daysSummary, formatTime } from './schedule';
import { useSkin } from './skins';
import { LCD_MAX_SCALE, layout, radii, sizes, spacing, type } from './theme';

const PRESSED_SCALE = 0.97;
const pressedStyle = ({ pressed }: { pressed: boolean }) => (pressed ? styles.pressed : null);

/** Largeur utile de l'app : celle du téléphone, plafonnée dans un navigateur. */
export function useAppWidth(): number {
  return Math.min(useWindowDimensions().width, sizes.maxAppWidth);
}

/** Étiquette en MAJUSCULES (Geist Mono). */
export function Label(props: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const skin = useSkin();
  return <Text style={[type.label, { color: props.color ?? skin.text3 }, props.style]}>{props.children}</Text>;
}

/** Chiffres d'écran LCD (DSEG7). */
export function Lcd(props: { children: ReactNode; style: TextStyle; label?: string }) {
  const skin = useSkin();
  return (
    <Text
      accessibilityLabel={props.label}
      maxFontSizeMultiplier={LCD_MAX_SCALE}
      style={[props.style, { color: skin.lcd, textShadowColor: skin.lcdGlow, textShadowRadius: 8 }]}
    >
      {props.children}
    </Text>
  );
}

/** Logo « LORA » en dégradé (Michroma). */
export function Brand({ small = false }: { small?: boolean }) {
  const skin = useSkin();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const style = small ? type.brandSmall : type.brand;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Lora">
      {/* Le texte invisible donne la taille ; le SVG dessine le dégradé par-dessus. */}
      <Text
        maxFontSizeMultiplier={LCD_MAX_SCALE}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
        style={[style, { lineHeight: style.fontSize, opacity: 0 }]}
      >
        LORA
      </Text>
      {box && (
        <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={small ? 'brandSmall' : 'brand'} css={skin.brand} />
          </Defs>
          <SvgText
            x={0}
            y={box.height / 2}
            alignmentBaseline="central"
            fontFamily={style.fontFamily}
            fontSize={box.height}
            letterSpacing={(style.letterSpacing * box.height) / style.fontSize}
            fill={`url(#${small ? 'brandSmall' : 'brand'})`}
          >
            LORA
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** Bouton discret : fond `ghost`, trait `line2`. Rond si `round` est donné. */
export function GhostButton(props: {
  label: string;
  onPress?: () => void;
  round?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  selected?: boolean;
}) {
  const skin = useSkin();
  const shape: ViewStyle = props.round
    ? { width: props.round, height: props.round, borderRadius: props.round / 2 }
    : { minHeight: sizes.touch, borderRadius: sizes.touch / 2, paddingHorizontal: layout.pillPadding };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled, selected: props.selected }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={(state) => [
        styles.ghost,
        shape,
        { backgroundColor: skin.ghost, borderColor: skin.line2 },
        props.style,
        pressedStyle(state),
        props.disabled && styles.disabled,
      ]}
    >
      {props.children}
    </Pressable>
  );
}

/** Bouton plein d'accent : l'action principale d'un écran. */
export function PrimaryButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  const skin = useSkin();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      onPress={props.onPress}
      disabled={props.disabled}
      style={(state) => [
        styles.primary,
        {
          backgroundColor: skin.accent,
          boxShadow: `0 10px 30px ${skin.accentGlow}, inset 0 1px 0 ${skin.glassHi}`,
        },
        pressedStyle(state),
        props.disabled && styles.disabled,
      ]}
    >
      <Text style={[type.primary, { color: skin.onAccent }]}>{props.label}</Text>
    </Pressable>
  );
}

/** Heure du réveil sur écran LCD, avec − et +, par pas de ALARM_STEP_MINUTES. */
export function TimeSetter(props: { schedule: AlarmSchedule; onShift: (minutes: number) => void; framed?: boolean }) {
  const skin = useSkin();
  const time = formatTime(props.schedule.hour, props.schedule.minute);
  const row = (
    <View style={styles.setter}>
      <GhostButton label={`Reculer de ${ALARM_STEP_MINUTES} minutes`} round={sizes.stepper} onPress={() => props.onShift(-ALARM_STEP_MINUTES)}>
        <Text style={[type.stepper, { color: skin.text2 }]}>−</Text>
      </GhostButton>
      <View style={styles.setterTime}>
        <Lcd style={type.lcdSetting} label={`Réveil à ${time}`}>
          {time}
        </Lcd>
        <Label color={skin.lcd} style={styles.lcdLabel}>
          {daysSummary(props.schedule.weekdays)}
        </Label>
      </View>
      <GhostButton label={`Avancer de ${ALARM_STEP_MINUTES} minutes`} round={sizes.stepper} onPress={() => props.onShift(ALARM_STEP_MINUTES)}>
        <Text style={[type.stepper, { color: skin.text2 }]}>+</Text>
      </GhostButton>
    </View>
  );
  if (props.framed === false) return row;
  return <Device contentStyle={styles.setterFrame}>{row}</Device>;
}

export function DayPicker(props: { weekdays: number[]; onToggle: (day: number) => void }) {
  const skin = useSkin();
  return (
    <View style={styles.days}>
      {WEEK_ORDER.map((day) => {
        const on = props.weekdays.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={dayName(day)}
            accessibilityState={{ checked: on }}
            onPress={() => props.onToggle(day)}
            style={(state) => [
              styles.day,
              { borderColor: skin.line2, backgroundColor: on ? skin.surface2 : 'transparent' },
              pressedStyle(state),
            ]}
          >
            <Text style={[type.day, { color: on ? skin.text : skin.text4 }]}>{dayLetter(day)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rappel discret que, dans le navigateur, l'alarme n'est que simulée. */
export function WebNotice() {
  const skin = useSkin();
  if (!ALARM_SIMULATED) return null;
  return (
    <Label color={skin.text4} style={styles.centered}>
      Aperçu web · alarme simulée
    </Label>
  );
}

/** Mention obligatoire du jeu de démonstration (aperçu web, ?demo=1). */
export function DemoNotice({ visible }: { visible: boolean }) {
  const skin = useSkin();
  if (!visible) return null;
  return (
    <View style={[styles.demo, { borderColor: skin.line2, backgroundColor: skin.labelBg }]}>
      <Label color={skin.text}>Données de démonstration</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: PRESSED_SCALE }] },
  disabled: { opacity: 0.5 },
  ghost: { borderWidth: sizes.hairline, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.m },
  primary: { minHeight: sizes.primary, borderRadius: sizes.primary / 2, alignItems: 'center', justifyContent: 'center' },
  setter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setterFrame: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl },
  setterTime: { alignItems: 'center', gap: spacing.m, flexShrink: 1 },
  lcdLabel: { opacity: 0.8 },
  days: { flexDirection: 'row', gap: spacing.s },
  day: {
    flex: 1,
    minHeight: sizes.touch,
    borderRadius: radii.day,
    borderWidth: sizes.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  demo: {
    alignSelf: 'center',
    borderWidth: sizes.hairline,
    borderRadius: radii.label,
    paddingHorizontal: layout.labelPad.horizontal,
    paddingVertical: layout.labelPad.vertical,
  },
});
