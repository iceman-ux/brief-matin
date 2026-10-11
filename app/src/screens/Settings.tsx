// Réglages : réveil, lecture, rubriques (bientôt), mention IA. Un appui long
// sur le logo programme une alarme de test dans une minute (accès caché).
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AI_NOTICE, TOPICS } from '../../constants';
import { ChevronLeftIcon } from '../icons';
import { formatTime, shiftTime, shortDays, toggleDay } from '../schedule';
import type { Settings as SettingsData } from '../settings';
import { colors, layout, radii, sizes, spacing, type } from '../theme';
import { Checkbox, DayPicker, Overline, TimeStepper, WebNotice } from '../ui';

type PlaybackKey = 'autoplayAfterAlarm' | 'downloadOnCellular';

type Props = {
  settings: SettingsData;
  onChange: (settings: SettingsData) => void;
  onBack: () => void;
  /** Rend le message à afficher sous le logo. */
  onTestAlarm: () => Promise<string>;
};

const PLAYBACK_ROWS: { key: PlaybackKey; label: string }[] = [
  { key: 'autoplayAfterAlarm', label: 'Lancer Lora après l’alarme' },
  { key: 'downloadOnCellular', label: 'Télécharger en 4G / 5G' },
];

export function Settings({ settings, onChange, onBack, onTestAlarm }: Props) {
  const [editing, setEditing] = useState<'time' | 'days' | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const alarm = settings.alarm;
  const toggleEditing = (row: 'time' | 'days') => setEditing((e) => (e === row ? null : row));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack} style={styles.back}>
          <ChevronLeftIcon size={sizes.icon} color={colors.ornament} />
        </Pressable>
        <Text style={type.pageTitle} accessibilityRole="header">
          Réglages
        </Text>
      </View>

      <Section title="RÉVEIL">
        <Group>
          <Row
            label="Heure"
            divider
            expanded={editing === 'time'}
            onPress={() => toggleEditing('time')}
            value={<Text style={type.timeRow}>{formatTime(alarm.hour, alarm.minute)}</Text>}
          />
          {editing === 'time' && (
            <View style={[styles.editor, styles.divider]}>
              <TimeStepper
                schedule={alarm}
                onShift={(m) => onChange({ ...settings, alarm: shiftTime(alarm, m) })}
              />
            </View>
          )}
          <Row
            label="Jours"
            divider
            expanded={editing === 'days'}
            onPress={() => toggleEditing('days')}
            value={<Text style={type.value}>{shortDays(alarm.weekdays)}</Text>}
          />
          {editing === 'days' && (
            <View style={[styles.editor, styles.divider]}>
              <DayPicker
                weekdays={alarm.weekdays}
                onToggle={(d) => onChange({ ...settings, alarm: toggleDay(alarm, d) })}
              />
            </View>
          )}
          {/* Un seul son pour l'instant : la ligne n'ouvre rien. */}
          <Row label="Son de l'alarme" value={<Text style={type.value}>Sonal Lora</Text>} />
        </Group>
        <WebNotice />
      </Section>

      <Section title="LECTURE">
        <Group>
          {PLAYBACK_ROWS.map((row, i) => (
            <Pressable
              key={row.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: settings[row.key] }}
              onPress={() => onChange({ ...settings, [row.key]: !settings[row.key] })}
              style={[styles.row, i < PLAYBACK_ROWS.length - 1 && styles.divider]}
            >
              <Text style={type.body}>{row.label}</Text>
              <Checkbox checked={settings[row.key]} />
            </Pressable>
          ))}
        </Group>
      </Section>

      <Section title="RUBRIQUES" aside="Bientôt à la carte">
        <View style={styles.tiles}>
          {TOPICS.map((topic) => (
            <View key={topic} style={styles.tile} accessibilityState={{ disabled: true }}>
              <Text style={type.tile}>{topic}</Text>
            </View>
          ))}
        </View>
      </Section>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="Lora"
          onLongPress={async () => setTestMessage(await onTestAlarm())}
          style={styles.footerLogo}
        >
          <Text style={type.logoFooter}>Lora</Text>
        </Pressable>
        {testMessage && <Text style={[type.small, styles.centered]}>{testMessage}</Text>}
        <Text style={[type.small, styles.centered, styles.notice]}>{AI_NOTICE}</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Overline>{title}</Overline>
        {aside && <Text style={type.small}>{aside}</Text>}
      </View>
      {children}
    </View>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Row(props: { label: string; value: ReactNode; divider?: boolean; expanded?: boolean; onPress?: () => void }) {
  const content = (
    <>
      <Text style={type.body}>{props.label}</Text>
      {props.value}
    </>
  );
  const style = [styles.row, props.divider && styles.divider];
  if (!props.onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={props.expanded ? 'Fermer le réglage' : 'Modifier'}
      accessibilityState={{ expanded: props.expanded }}
      onPress={props.onPress}
      style={style}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingTop: layout.screenTop,
    paddingHorizontal: layout.gutter,
    paddingBottom: layout.bottom,
    gap: spacing.xxl,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: layout.backOffset,
  },
  section: { gap: spacing.m },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  group: {
    borderRadius: radii.group,
    backgroundColor: colors.card,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
  },
  row: {
    minHeight: sizes.row,
    paddingHorizontal: layout.rowPaddingH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { borderBottomWidth: sizes.hairline, borderBottomColor: colors.divider },
  editor: { paddingVertical: spacing.l, alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  tile: {
    // Deux colonnes : la moitié de la ligne, moins la moitié de l'espace.
    flexBasis: '48%',
    flexGrow: 1,
    height: sizes.tile,
    borderRadius: radii.tile,
    borderWidth: sizes.hairline,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { marginTop: 'auto', gap: spacing.s, alignItems: 'center' },
  footerLogo: { minHeight: sizes.touch, minWidth: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  notice: { maxWidth: sizes.noticeMaxWidth },
});
