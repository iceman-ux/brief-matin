// Lecteur : objet lecteur (lieu du sujet, temps, spectre, progression),
// commandes, et le programme du brief. Les sujets ne se touchent, et les
// boutons sujet précédent / suivant n'existent, que si le flux donne leurs
// débuts.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PLAYBACK_RATES, SKIP_SECONDS } from '../../constants';
import { Device } from '../components/Device';
import { Knob } from '../components/Knob';
import { type Mark, ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { Spectrum } from '../components/Spectrum';
import { TopicSheet } from '../components/TopicSheet';
import { type Episode, episodeDay, episodeDuration } from '../episodes';
import { ChevronLeftIcon, NextIcon, PreviousIcon } from '../icons';
import { formatClock, formatDayMonth, formatLcd } from '../schedule';
import { tintOf, useSkin } from '../skins';
import { timedTopics, topicAt, topicNumber } from '../topics';
import { layout, radii, sizes, spacing, type } from '../theme';
import { GhostButton, Label, Lcd } from '../ui';

export type Playback = {
  /** Épisode chargé dans le lecteur, null avant la première écoute. */
  guid: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  buffering: boolean;
  rate: number;
};

type Props = {
  episode: Episode;
  playback: Playback;
  now: Date;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onRate: (rate: number) => void;
  onClose: () => void;
};

// « Sujet précédent » au-delà de ces secondes revient au début du sujet en
// cours, comme sur un lecteur de disques.
const RESTART_THRESHOLD_S = 3;

/** « 1× », « 1,25× ». */
const rateLabel = (rate: number) => `${String(rate).replace('.', ',')}×`;

export function Player({ episode, playback, now, onToggle, onSeek, onRate, onClose }: Props) {
  const skin = useSkin();
  const [sheet, setSheet] = useState<number | null>(null);
  const topics = episode.topics;
  const loaded = playback.guid === episode.guid;
  // Avant le chargement, le lecteur ne connaît pas encore la durée : celle du
  // flux tient lieu d'attente.
  const duration = (loaded && playback.duration > 0 ? playback.duration : episodeDuration(episode)) || 0;
  const current = loaded ? Math.min(playback.currentTime, duration) : 0;
  const playing = loaded && playback.playing;
  const timed = timedTopics(topics);
  const starts = timed.length > 0;
  const active = topicAt(topics, current);
  const activeTopic = active === null ? null : topics[active];
  const tint = active === null ? skin.text3 : tintOf(skin, active);

  const seekBy = (delta: number) => onSeek(Math.max(0, Math.min(duration, current + delta)));
  const goTo = (i: number) => onSeek(topics[i].start as number);
  // Précédent et suivant ne passent que par les sujets datés.
  const at = active === null ? -1 : timed.indexOf(active);
  const previous = () => {
    if (active === null) return goTo(timed[0]);
    const start = topics[active].start as number;
    goTo(current - start > RESTART_THRESHOLD_S || at === 0 ? active : timed[at - 1]);
  };
  const next = () => goTo(timed[Math.min(timed.length - 1, at + 1)]);
  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(playback.rate) + 1) % PLAYBACK_RATES.length];

  const marks: Mark[] =
    duration > 0
      ? timed.map((i) => ({
          at: (topics[i].start as number) / duration,
          topic: i,
          label: `Aller au sujet ${i + 1}`,
          active: i === active,
          onPress: () => goTo(i),
        }))
      : [];

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <GhostButton label="Retour à l'accueil" round={sizes.touch} onPress={onClose}>
          <ChevronLeftIcon size={sizes.icon} color={skin.text} />
        </GhostButton>
        <Text style={[type.barTitle, styles.title, { color: skin.text }]} accessibilityRole="header">
          Brief du {formatDayMonth(episodeDay(episode))}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <Device glow={{ x: 0.3, y: 0.2 }} contentStyle={styles.device}>
        <View style={styles.deviceTop}>
          {activeTopic?.place ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Voir la fiche : ${activeTopic.place.city}, ${activeTopic.place.country}`}
              onPress={() => setSheet(active)}
              style={styles.place}
            >
              <View style={[styles.placeDot, { backgroundColor: tint }]} />
              <Label color={tint} style={styles.placeText}>
                {activeTopic.place.city} · {activeTopic.place.country} ›
              </Label>
            </Pressable>
          ) : (
            <View />
          )}
          {duration > 0 && (
            <Label color={skin.lcd} style={styles.remain}>
              -{formatLcd(duration - current)}
            </Label>
          )}
        </View>
        <Lcd style={type.lcdPlayer} label={`Temps écoulé ${formatClock(current)}`}>
          {formatLcd(current)}
        </Lcd>
        {/* La place du spectre reste réservée en pause : rien ne saute. */}
        <View style={[styles.spectrum, !playing && styles.hidden]}>
          {playing && <Spectrum bars={sizes.spectrumPlayer.bars} height={sizes.spectrumPlayer.height} />}
        </View>
        <ProgressBar
          progress={duration > 0 ? current / duration : 0}
          duration={duration}
          current={current}
          marks={marks}
          onSeek={(f) => onSeek(f * duration)}
        />
      </Device>

      <View style={styles.controls}>
        <GhostButton label={`Reculer de ${SKIP_SECONDS} secondes`} round={sizes.control} onPress={() => seekBy(-SKIP_SECONDS)}>
          <Text style={[type.dataMedium, { color: skin.text2 }]}>-{SKIP_SECONDS}</Text>
        </GhostButton>
        {starts && (
          <GhostButton label="Sujet précédent" round={sizes.control} onPress={previous}>
            <PreviousIcon size={sizes.iconMedium} color={skin.text} />
          </GhostButton>
        )}
        <Knob
          size={sizes.knobPlayer}
          iconSize={playing ? sizes.iconPlayLarge - 2 : sizes.iconPlayLarge}
          playing={playing}
          label={playing ? 'Pause' : 'Lecture'}
          onPress={onToggle}
        />
        {starts && (
          <GhostButton label="Sujet suivant" round={sizes.control} onPress={next} disabled={at === timed.length - 1}>
            <NextIcon size={sizes.iconMedium} color={skin.text} />
          </GhostButton>
        )}
        <GhostButton label={`Vitesse de lecture : ${rateLabel(playback.rate)}`} round={sizes.control} onPress={() => onRate(nextRate)}>
          <Text style={[type.dataMedium, { color: skin.text }]}>{rateLabel(playback.rate)}</Text>
        </GhostButton>
      </View>
      {playback.buffering && loaded && <Label style={styles.centered}>Chargement…</Label>}

      {topics.length > 0 && (
        <View style={styles.program}>
          <Label style={styles.programTitle}>Au programme</Label>
          {topics.map((t, i) => {
            const on = i === active;
            const color = tintOf(skin, i);
            const row = (
              <>
                <View style={[styles.activeBar, { backgroundColor: on ? color : 'transparent' }]} />
                <Text style={[type.data, styles.number, { color: on ? color : skin.text4 }]}>{topicNumber(i)}</Text>
                <Text numberOfLines={2} style={[on ? type.rowActive : type.row, styles.rowTitle, { color: on ? skin.text : skin.text2 }]}>
                  {t.title}
                </Text>
                {t.start !== undefined && (
                  <Text style={[type.data, { color: on ? skin.text2 : skin.text4 }]}>{formatClock(t.start)}</Text>
                )}
              </>
            );
            const style = [styles.row, on && { backgroundColor: skin.surface2 }];
            return t.start !== undefined && timed.includes(i) ? (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Sujet ${topicNumber(i)} : ${t.title}`}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  goTo(i);
                  if (!playing) onToggle();
                }}
                style={style}
              >
                {row}
              </Pressable>
            ) : (
              <View key={i} accessible accessibilityLabel={`Sujet ${topicNumber(i)} : ${t.title}`} style={style}>
                {row}
              </View>
            );
          })}
        </View>
      )}

      <TopicSheet topics={topics} index={sheet} onIndex={setSheet} onClose={() => setSheet(null)} now={now} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.section },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l },
  headerSpacer: { width: sizes.touch },
  title: { flexShrink: 1, textAlign: 'center' },
  device: {
    paddingVertical: layout.devicePlayer.vertical,
    paddingHorizontal: layout.devicePlayer.horizontal,
    gap: spacing.xl,
  },
  deviceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, minHeight: sizes.touch, flexShrink: 1, marginVertical: -spacing.l },
  placeDot: { width: sizes.dot, height: sizes.dot, borderRadius: sizes.dot / 2 },
  placeText: { flexShrink: 1 },
  remain: { opacity: 0.7 },
  spectrum: { height: sizes.spectrumPlayer.height },
  hidden: { opacity: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centered: { textAlign: 'center' },
  program: { gap: spacing.xs },
  programTitle: { marginBottom: spacing.l },
  row: {
    minHeight: sizes.touch + spacing.xxl + spacing.m,
    borderRadius: radii.chip,
    paddingVertical: layout.rowPad.vertical,
    paddingRight: layout.rowPad.right,
    paddingLeft: layout.rowPad.left,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  activeBar: { position: 'absolute', left: 0, top: spacing.row, bottom: spacing.row, width: sizes.activeBar, borderRadius: sizes.activeBar },
  number: { width: sizes.numberColumn },
  rowTitle: { flex: 1 },
});
