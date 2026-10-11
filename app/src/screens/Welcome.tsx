// Bienvenue : premier lancement seulement. On choisit l'heure et les jours,
// puis « Activer mon réveil » demande l'autorisation et programme l'alarme.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Illustration } from '../Illustration';
import { type AlarmSchedule, shiftTime, toggleDay } from '../schedule';
import { colors, layout, spacing, type } from '../theme';
import { DayPicker, Overline, PrimaryButton, TimeStepper, WebNotice, useAppWidth } from '../ui';

type Props = {
  schedule: AlarmSchedule;
  onChange: (schedule: AlarmSchedule) => void;
  onActivate: () => void;
  busy: boolean;
  error: string | null;
};

export function Welcome({ schedule, onChange, onActivate, busy, error }: Props) {
  const width = useAppWidth();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} bounces={false}>
      <Illustration variant="hero" width={width} />
      <View style={styles.body}>
        <View style={styles.brand}>
          <Text style={type.brandOverline}>LE BRIEF DU MATIN</Text>
          <Text style={type.logoHero} accessibilityRole="header">
            Lora
          </Text>
          <Text style={type.tagline}>l'essentiel du jour, avant l'aube</Text>
        </View>

        <View style={styles.alarm}>
          <Overline large>RÉVEILLE-MOI À</Overline>
          <TimeStepper schedule={schedule} onShift={(m) => onChange(shiftTime(schedule, m))} />
          <DayPicker weekdays={schedule.weekdays} onToggle={(d) => onChange(toggleDay(schedule, d))} />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label="Activer mon réveil"
            onPress={onActivate}
            disabled={busy || schedule.weekdays.length === 0}
          />
          {error ? (
            <Text style={[type.note, styles.centered, styles.error]}>{error}</Text>
          ) : (
            <Text style={[type.note, styles.centered]}>
              Lora sonne comme une alarme, puis lance le brief du jour. iOS te demandera l'autorisation.
            </Text>
          )}
          <WebNotice />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  body: {
    flexGrow: 1,
    paddingHorizontal: layout.welcomeGutter,
    paddingTop: layout.welcomeGutter,
    paddingBottom: layout.bottomLoose,
    gap: spacing.section,
  },
  brand: { alignItems: 'center', gap: spacing.m },
  alarm: { alignItems: 'center', gap: spacing.l },
  footer: { marginTop: 'auto', gap: spacing.l },
  centered: { textAlign: 'center' },
  error: { color: colors.accent },
});
