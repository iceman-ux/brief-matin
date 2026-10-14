// Accueil : le brief du jour sur l'objet lecteur, la carte et le titre du
// sujet choisi, les boutons de sujet. La date ouvre les briefs précédents ;
// la pilule du réveil, les Réglages ; l'écran LCD, le Lecteur.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HISTORY_DAYS } from '../../constants';
import { Device } from '../components/Device';
import { Knob } from '../components/Knob';
import { type Mark, ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Spectrum } from '../components/Spectrum';
import { TopicChips } from '../components/TopicChips';
import { TopicMap } from '../components/TopicMap';
import { TopicSheet } from '../components/TopicSheet';
import { type Episode, episodeDay, episodeDuration } from '../episodes';
import { BellIcon, PlaySmallIcon } from '../icons';
import { type AlarmSchedule, formatClock, formatDayTitle, formatDuration, formatLcd, formatMinutes, formatTime, nextAlarm } from '../schedule';
import { tintOf, useSkin } from '../skins';
import { timedTopics, topicAt } from '../topics';
import { layout, radii, sizes, spacing, type } from '../theme';
import { Brand, DemoNotice, GhostButton, Label, Lcd, WebNotice } from '../ui';
import type { Playback } from './Player';

type Props = {
  alarm: AlarmSchedule;
  /** Alarme refusée ou impossible à programmer : dit sous l'en-tête. */
  alarmProblem: string | null;
  episodes: Episode[];
  feedError: string | null;
  now: Date;
  playback: Playback;
  demo: boolean;
  onToggle: (episode: Episode) => void;
  onPlayAt: (episode: Episode, seconds: number) => void;
  onSeek: (seconds: number) => void;
  onOpenPlayer: (episode: Episode) => void;
  onOpenSettings: () => void;
  /** Aperçu web : sujet choisi et fiche ouverte au chargement. */
  initialTopic?: number | null;
  initialSheet?: number | null;
};

export function Home(props: Props) {
  const { episodes, playback, now } = props;
  const skin = useSkin();
  const [selected, setSelected] = useState(props.initialTopic ?? 0);
  const [sheet, setSheet] = useState<number | null>(props.initialSheet ?? null);
  const [history, setHistory] = useState(false);

  const episode = episodes[0] ?? null;
  const topics = episode?.topics ?? [];
  const loaded = episode !== null && playback.guid === episode.guid;
  const playing = loaded && playback.playing;
  const duration = (loaded && playback.duration > 0 ? playback.duration : episode && episodeDuration(episode)) || 0;
  const current = loaded ? Math.min(playback.currentTime, duration) : 0;
  const timed = timedTopics(topics);
  const playingTopic = loaded ? topicAt(topics, current) : null;

  // Pendant la lecture, le sujet affiché suit l'audio.
  useEffect(() => {
    if (playingTopic !== null) setSelected(playingTopic);
  }, [playingTopic]);

  const index = Math.min(selected, Math.max(0, topics.length - 1));
  const topic = topics[index];
  const tint = tintOf(skin, index);

  const pick = (i: number) => {
    setSelected(i);
    const start = topics[i]?.start;
    if (loaded && timed.includes(i) && start !== undefined) props.onSeek(start);
  };

  const marks: Mark[] =
    duration > 0
      ? timed.map((i) => ({
          at: (topics[i].start as number) / duration,
          topic: i,
          label: `Aller au sujet ${i + 1}`,
          active: i === index,
          onPress: () => (loaded ? pick(i) : episode && props.onPlayAt(episode, topics[i].start as number)),
        }))
      : [];

  const next = nextAlarm(props.alarm, now);
  const alarmTime = formatTime(props.alarm.hour, props.alarm.minute);
  const summary = episode
    ? [topics.length > 0 && `${topics.length} sujets`, duration > 0 && formatMinutes(duration)].filter(Boolean).join(' · ')
    : null;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Brand />
        <GhostButton
          label={next ? `Réveil à ${props.alarm.hour} h ${String(props.alarm.minute).padStart(2, '0')}, modifier` : 'Réveil désactivé, modifier'}
          onPress={props.onOpenSettings}
        >
          <BellIcon size={sizes.bell} color={skin.accent} />
          <Text style={[type.dataLarge, { color: skin.text }]}>{next ? alarmTime : 'Off'}</Text>
        </GhostButton>
      </View>
      {props.alarmProblem && <Text style={[type.hint, { color: skin.text2 }]}>{props.alarmProblem}</Text>}

      {episode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${formatDayTitle(episodeDay(episode))}. Briefs précédents`}
          onPress={() => setHistory(true)}
          style={styles.date}
        >
          <Text style={[type.date, { color: skin.text }]}>{formatDayTitle(episodeDay(episode))}</Text>
          {summary ? <Label>{summary}</Label> : null}
        </Pressable>
      ) : (
        <Text style={[type.body, { color: skin.text2 }]}>
          {props.feedError ? `Flux indisponible : ${props.feedError}` : 'Chargement du brief…'}
        </Text>
      )}

      <Device contentStyle={styles.device}>
        <View style={styles.deviceRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le lecteur"
            disabled={!episode}
            onPress={() => episode && props.onOpenPlayer(episode)}
            style={styles.screenLink}
          >
            <Lcd style={type.lcdHome} label={`Temps écoulé ${formatClock(current)}`}>
              {formatLcd(current)}
            </Lcd>
            {playing ? (
              <View style={styles.spectrum}>
                <Spectrum bars={sizes.spectrumHome.bars} height={sizes.spectrumHome.height} />
              </View>
            ) : duration > 0 ? (
              <Label color={skin.lcd} style={styles.remain}>
                Reste {formatLcd(duration - current)}
              </Label>
            ) : null}
          </Pressable>
          <Knob
            size={sizes.knobHome}
            iconSize={playing ? sizes.iconPlay - 2 : sizes.iconPlay}
            playing={playing}
            label={playing ? 'Pause' : 'Lancer le brief'}
            disabled={!episode}
            onPress={() => episode && props.onToggle(episode)}
          />
        </View>
        <ProgressBar
          progress={duration > 0 ? current / duration : 0}
          duration={duration}
          current={current}
          marks={marks}
          onSeek={loaded ? (f) => props.onSeek(f * duration) : undefined}
        />
      </Device>

      {topic?.place && <TopicMap place={topic.place} tint={tint} index={index} onPress={() => setSheet(index)} />}

      {(topic || episode?.hook) && (
        <View style={styles.topic}>
          <Text style={[type.topicTitle, { color: skin.text }]}>{topic?.title ?? episode?.hook}</Text>
          {topic && (topic.start !== undefined || topic.sources) && (
            <View style={styles.topicRow}>
              {topic.start !== undefined && episode ? (
                <GhostButton label={`Écouter ce sujet, à ${formatClock(topic.start)}`} onPress={() => props.onPlayAt(episode, topic.start as number)}>
                  <PlaySmallIcon size={sizes.iconSmall} color={skin.accent} />
                  <Text style={[type.pill, { color: skin.text }]}>Écouter ce sujet</Text>
                  <Text style={[type.dataLarge, { color: skin.text3 }]}>{formatClock(topic.start)}</Text>
                </GhostButton>
              ) : (
                <View />
              )}
              {topic.sources && (
                <Label>
                  {topic.sources.length} {topic.sources.length > 1 ? 'sources' : 'source'}
                </Label>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.bottom}>
        {topics.length > 1 && <TopicChips topics={topics} active={index} onPick={pick} />}
        <DemoNotice visible={props.demo} />
        <WebNotice />
      </View>

      <TopicSheet topics={topics} index={sheet} onIndex={setSheet} onClose={() => setSheet(null)} now={now} />
      <HistorySheet
        visible={history}
        episodes={episodes.slice(1, 1 + HISTORY_DAYS)}
        onClose={() => setHistory(false)}
        onPick={(e) => {
          setHistory(false);
          props.onOpenPlayer(e);
        }}
      />
    </Screen>
  );
}

function HistorySheet(props: { visible: boolean; episodes: Episode[]; onClose: () => void; onPick: (e: Episode) => void }) {
  const skin = useSkin();
  return (
    <Sheet visible={props.visible} onClose={props.onClose} closeLabel="Fermer les briefs précédents">
      <Text style={[type.sheetTitle, { color: skin.text }]} accessibilityRole="header">
        Briefs précédents
      </Text>
      <View style={[styles.history, { backgroundColor: skin.surface, borderColor: skin.line }]}>
        {props.episodes.length === 0 && <Text style={[type.value, styles.historyEmpty, { color: skin.text2 }]}>Aucun brief précédent.</Text>}
        {props.episodes.map((e, i) => {
          const d = episodeDuration(e);
          return (
            <Pressable
              key={e.guid}
              accessibilityRole="button"
              accessibilityLabel={`Écouter le brief du ${formatDayTitle(episodeDay(e))}`}
              onPress={() => props.onPick(e)}
              style={[styles.historyRow, i > 0 && { borderTopWidth: sizes.hairline, borderTopColor: skin.line }]}
            >
              <View style={styles.historyText}>
                <Text style={[type.bodyStrong, { color: skin.text }]}>{formatDayTitle(episodeDay(e))}</Text>
                {e.hook && (
                  <Text numberOfLines={1} style={[type.hint, { color: skin.text2 }]}>
                    {e.hook}
                  </Text>
                )}
              </View>
              {d !== null && <Text style={[type.dataMedium, { color: skin.text3 }]}>{formatDuration(d)}</Text>}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.section },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { gap: spacing.s, minHeight: sizes.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  device: {
    paddingTop: layout.deviceHome.top,
    paddingRight: layout.deviceHome.right,
    paddingBottom: layout.deviceHome.bottom,
    paddingLeft: layout.deviceHome.left,
    gap: spacing.xl,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl },
  screenLink: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l },
  spectrum: { width: sizes.spectrumHome.width },
  remain: { opacity: 0.75, flexShrink: 1 },
  topic: { gap: spacing.row },
  topicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l },
  bottom: { marginTop: 'auto', gap: spacing.xxl },
  history: { borderRadius: radii.card, borderWidth: sizes.hairline, paddingHorizontal: layout.cardPadding },
  historyEmpty: { paddingVertical: layout.cardPadding },
  historyRow: {
    minHeight: sizes.touch + spacing.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.l,
    paddingVertical: spacing.ml,
  },
  historyText: { flexShrink: 1, gap: spacing.xxs },
});
