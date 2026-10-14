// Bienvenue : premier lancement seulement. On choisit l'heure et les jours,
// puis « Activer le réveil » demande l'autorisation et programme l'alarme.
import { StyleSheet, Text, View } from 'react-native';

import { Globe } from '../components/Globe';
import { Screen } from '../components/Screen';
import { type AlarmSchedule, shiftTime, toggleDay } from '../schedule';
import { useSkin } from '../skins';
import type { Place } from '../topics';
import { sizes, spacing, type } from '../theme';
import { Brand, DayPicker, Label, PrimaryButton, TimeSetter, WebNotice } from '../ui';

type Props = {
  schedule: AlarmSchedule;
  onChange: (schedule: AlarmSchedule) => void;
  onActivate: () => void;
  busy: boolean;
  error: string | null;
  /** Lieux des sujets du jour, quand le flux les donne : points du globe. */
  places: (Place | undefined)[];
};

export function Welcome({ schedule, onChange, onActivate, busy, error, places }: Props) {
  const skin = useSkin();
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Brand />
      </View>
      <View style={styles.globe}>
        <Globe size={sizes.globe} places={places} />
      </View>

      <View style={styles.pitch}>
        <Text style={[type.screenTitle, { color: skin.text }]} accessibilityRole="header">
          Le monde en 3 minutes, au réveil.
        </Text>
        <Text style={[type.body, styles.subtitle, { color: skin.text2 }]}>
          Ton réveil lance le brief : 4 sujets, 2 voix, et la carte de chaque actu.
        </Text>
      </View>

      <View style={styles.alarm}>
        <TimeSetter schedule={schedule} onShift={(m) => onChange(shiftTime(schedule, m))} />
        <DayPicker weekdays={schedule.weekdays} onToggle={(d) => onChange(toggleDay(schedule, d))} />
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Activer le réveil" onPress={onActivate} disabled={busy || schedule.weekdays.length === 0} />
        {error ? (
          <Text style={[type.hint, styles.centered, { color: skin.text }]}>{error}</Text>
        ) : (
          <Label color={skin.text4} style={styles.centered}>
            Sans compte · sans pub
          </Label>
        )}
        <WebNotice />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.section },
  brand: { alignItems: 'center' },
  globe: { alignItems: 'center' },
  pitch: { gap: spacing.l },
  subtitle: { paddingRight: spacing.xxl },
  alarm: { gap: spacing.xxl },
  footer: { marginTop: 'auto', gap: spacing.xxl },
  centered: { textAlign: 'center' },
});
