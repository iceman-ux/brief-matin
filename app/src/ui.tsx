// Éléments partagés par les écrans. Toute l'apparence vient de theme.ts.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ALARM_STEP_MINUTES } from '../constants';
import { ALARM_SIMULATED } from './alarm';
import { CheckIcon } from './icons';
import { type AlarmSchedule, WEEK_ORDER, dayLetter, dayName, formatTime } from './schedule';
import { colors, layout, radii, sizes, spacing, type } from './theme';

/** Largeur utile de l'app : celle du téléphone, plafonnée dans un navigateur. */
export function useAppWidth(): number {
  return Math.min(useWindowDimensions().width, sizes.maxAppWidth);
}

/** Largeur d'un bloc posé entre les marges de l'écran. */
export function useContentWidth(gutter: number = layout.gutter): number {
  return useAppWidth() - 2 * gutter;
}

export function Overline({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return <Text style={large ? type.overlineLarge : type.overline}>{children}</Text>;
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  height?: number;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const height = props.height ?? sizes.primaryButton;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.primary,
        { height, borderRadius: height / 2 },
        (pressed || props.disabled) && styles.pressed,
      ]}
    >
      {props.icon}
      <Text style={type.button}>{props.label}</Text>
    </Pressable>
  );
}

/** Heure du réveil avec − et +, par pas de ALARM_STEP_MINUTES. */
export function TimeStepper(props: { schedule: AlarmSchedule; onShift: (minutes: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plus tôt"
        onPress={() => props.onShift(-ALARM_STEP_MINUTES)}
        style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
      >
        <Text style={type.stepper}>−</Text>
      </Pressable>
      <Text style={[type.timeHero, styles.time]} accessibilityLabel={`Réveil à ${formatTime(props.schedule.hour, props.schedule.minute)}`}>
        {formatTime(props.schedule.hour, props.schedule.minute)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plus tard"
        onPress={() => props.onShift(ALARM_STEP_MINUTES)}
        style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}
      >
        <Text style={type.stepper}>+</Text>
      </Pressable>
    </View>
  );
}

export function DayPicker(props: { weekdays: number[]; onToggle: (day: number) => void }) {
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
            style={[styles.day, on ? styles.dayOn : styles.dayOff]}
          >
            <Text style={[type.day, { color: on ? colors.onAccent : colors.textMuted }]}>{dayLetter(day)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked ? styles.checkboxOn : styles.checkboxOff]}>
      {checked && <CheckIcon size={sizes.checkbox - spacing.xs} color={colors.onAccent} />}
    </View>
  );
}

/** Rappel discret que, dans le navigateur, l'alarme n'est que simulée. */
export function WebNotice() {
  if (!ALARM_SIMULATED) return null;
  return <Text style={[type.small, styles.centered]}>Aperçu web : l'alarme réelle fonctionne sur iPhone.</Text>;
}

/** Losange des listes de sujets. */
export function Diamond() {
  return <View style={styles.diamond} />;
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.ml,
  },
  pressed: { opacity: 0.7 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  stepper: {
    width: sizes.stepper,
    height: sizes.stepper,
    borderRadius: sizes.stepper / 2,
    borderWidth: sizes.hairline,
    borderColor: colors.stepper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { minWidth: sizes.timeMinWidth, textAlign: 'center' },
  days: { flexDirection: 'row', gap: spacing.dayGap, justifyContent: 'center' },
  day: {
    width: sizes.dayWidth,
    height: sizes.touch,
    borderRadius: radii.day,
    borderWidth: sizes.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayOff: { backgroundColor: colors.transparent, borderColor: colors.dayOff },
  checkbox: {
    width: sizes.checkbox,
    height: sizes.checkbox,
    borderRadius: radii.check,
    borderWidth: sizes.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxOff: { backgroundColor: colors.transparent, borderColor: colors.dayOff },
  centered: { textAlign: 'center' },
  diamond: {
    width: sizes.diamond,
    height: sizes.diamond,
    borderWidth: sizes.hairline,
    borderColor: colors.ornament,
    transform: [{ rotate: '45deg' }],
  },
});
