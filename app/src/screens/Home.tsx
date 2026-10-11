// Accueil : prochain réveil, épisode du jour, jours précédents.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HISTORY_DAYS } from '../../constants';
import { type Episode, episodeDay, episodeDuration } from '../episodes';
import { Illustration } from '../Illustration';
import { GearIcon, PlayIcon } from '../icons';
import {
  type AlarmSchedule,
  describeDays,
  formatDay,
  formatDayTitle,
  formatDuration,
  formatTime,
  nextAlarm,
  relativeDay,
} from '../schedule';
import { colors, layout, radii, sizes, spacing, type } from '../theme';
import { Overline, PrimaryButton, WebNotice, useContentWidth } from '../ui';

type Props = {
  alarm: AlarmSchedule;
  /** Alarme refusée ou impossible à programmer : remplace la ligne des jours. */
  alarmProblem: string | null;
  episodes: Episode[];
  feedError: string | null;
  now: Date;
  onListen: (episode: Episode) => void;
  onOpenSettings: () => void;
};

const durationLabel = (episode: Episode) => {
  const d = episodeDuration(episode);
  return d === null ? null : formatDuration(d);
};

export function Home({ alarm, alarmProblem, episodes, feedError, now, onListen, onOpenSettings }: Props) {
  const cardWidth = useContentWidth();
  const next = nextAlarm(alarm, now);
  const [today, ...previous] = episodes;
  const alarmLine = alarmProblem ?? (next ? `${relativeDay(next, now)} · ${describeDays(alarm.weekdays)}` : 'Aucun jour choisi');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={type.brandOverline}>LE BRIEF DU MATIN</Text>
          <Text style={type.logoHeader} accessibilityRole="header">
            Lora
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réglages"
          onPress={onOpenSettings}
          style={styles.roundButton}
        >
          <GearIcon size={sizes.settingsIcon} color={colors.ornament} />
        </Pressable>
      </View>

      <View style={styles.alarmCard}>
        <View style={styles.alarmText}>
          <Overline>PROCHAIN RÉVEIL</Overline>
          <Text style={type.timeCard}>{formatTime(alarm.hour, alarm.minute)}</Text>
          <Text style={type.value}>{alarmLine}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.link}>
          <Text style={type.link}>Modifier</Text>
        </Pressable>
      </View>

      <View style={styles.episodeCard}>
        <View>
          <Illustration variant="card" width={cardWidth} />
          <View style={styles.badge}>
            <Text style={type.badge}>
              {today && sameDay(episodeDay(today), now) ? "AUJOURD'HUI" : 'DERNIER ÉPISODE'}
            </Text>
          </View>
        </View>
        <View style={styles.episodeBody}>
          {today ? (
            <>
              <Text style={type.episodeMeta}>
                {[formatDay(episodeDay(today)), durationLabel(today)].filter(Boolean).join(' · ').toUpperCase()}
              </Text>
              {today.hook && <Text style={type.hook}>{today.hook}</Text>}
            </>
          ) : (
            <Text style={type.value}>{feedError ? `Flux indisponible : ${feedError}` : 'Chargement du brief…'}</Text>
          )}
          <View style={styles.listen}>
            <PrimaryButton
              label="Écouter Lora"
              height={sizes.cardButton}
              icon={<PlayIcon size={sizes.cardPlayIcon} color={colors.onAccent} />}
              onPress={() => today && onListen(today)}
              disabled={!today}
            />
          </View>
        </View>
      </View>

      {previous.length > 0 && (
        <View style={styles.history}>
          <View style={styles.historyTitle}>
            <Overline>LES JOURS PRÉCÉDENTS</Overline>
          </View>
          {previous.slice(0, HISTORY_DAYS).map((episode, i, list) => (
            <Pressable
              key={episode.guid}
              accessibilityRole="button"
              accessibilityLabel={`Écouter le brief du ${formatDay(episodeDay(episode))}`}
              onPress={() => onListen(episode)}
              style={[styles.historyRow, i < list.length - 1 && styles.historyDivider]}
            >
              <Text style={type.body}>{formatDayTitle(episodeDay(episode))}</Text>
              <Text style={type.meta}>{durationLabel(episode)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <WebNotice />
    </ScrollView>
  );
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: layout.homeTop,
    paddingHorizontal: layout.gutter,
    paddingBottom: layout.bottom,
    gap: spacing.section,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  brand: { gap: spacing.xs },
  roundButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    borderWidth: sizes.hairline,
    borderColor: colors.frame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmCard: {
    borderWidth: sizes.hairline,
    borderColor: colors.frame,
    borderRadius: radii.panel,
    paddingVertical: layout.cardPaddingV,
    paddingHorizontal: layout.cardPaddingH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
  },
  alarmText: { gap: spacing.s, flexShrink: 1 },
  link: { minHeight: sizes.touch, justifyContent: 'center', paddingLeft: spacing.l },
  episodeCard: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: colors.cardBright },
  badge: {
    position: 'absolute',
    left: layout.cardPaddingH,
    top: layout.badgeTop,
    backgroundColor: colors.badge,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.ml,
    borderRadius: radii.badge,
  },
  episodeBody: {
    paddingTop: layout.cardPaddingV,
    paddingHorizontal: layout.cardPaddingH,
    paddingBottom: layout.cardPaddingH,
    gap: spacing.ml,
  },
  listen: { marginTop: spacing.s },
  history: { gap: spacing.xs },
  historyTitle: { paddingBottom: spacing.s },
  historyRow: {
    minHeight: sizes.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDivider: { borderBottomWidth: sizes.hairline, borderBottomColor: colors.listDivider },
});
