// Lecture : pochette, progression réelle, −15 s, lecture/pause, +15 s, et le
// sommaire quand le flux le donne.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SKIP_SECONDS } from '../../constants';
import { type Episode, episodeDay, episodeDuration } from '../episodes';
import { Illustration } from '../Illustration';
import { ChevronDownIcon, PauseIcon, PlayIcon } from '../icons';
import { formatClock, formatDay, formatDuration } from '../schedule';
import { colors, layout, radii, sizes, spacing, type } from '../theme';
import { Diamond, Overline, useContentWidth } from '../ui';

export type PlaybackState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffering: boolean;
};

type Props = {
  episode: Episode;
  playback: PlaybackState;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
};

export function Player({ episode, playback, onToggle, onSeek, onClose }: Props) {
  const coverWidth = useContentWidth();
  const [barWidth, setBarWidth] = useState(0);
  // Avant le chargement, le lecteur ne connaît pas encore la durée : celle du
  // flux tient lieu d'attente.
  const duration = playback.duration > 0 ? playback.duration : (episodeDuration(episode) ?? 0);
  const current = Math.min(playback.currentTime, duration);
  const progress = duration > 0 ? current / duration : 0;
  const thumbLeft = progress * barWidth - sizes.thumb / 2;
  const seekBy = (delta: number) => onSeek(Math.max(0, Math.min(duration, current + delta)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={styles.iconButton}>
          <ChevronDownIcon size={sizes.icon} color={colors.ornament} />
        </Pressable>
        <Overline>{formatDay(episodeDay(episode)).toUpperCase()}</Overline>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.cover}>
        <Illustration variant="cover" width={coverWidth} />
        <Text style={[type.logoCover, styles.coverTitle]}>Lora</Text>
      </View>

      <View style={styles.titles}>
        <Text style={[type.quote, styles.centered]}>« Ici Lora, il est l'heure. »</Text>
        <Text style={[type.meta, styles.centered]}>
          Léa et Marc{duration > 0 ? ` · ${formatDuration(duration)}` : ''}
          {playback.buffering ? ' · chargement…' : ''}
        </Text>
      </View>

      <View style={styles.progressBlock}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Position dans le brief"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(current) }}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={(e) => barWidth > 0 && onSeek((e.nativeEvent.locationX / barWidth) * duration)}
          style={styles.progressHit}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            <View style={[styles.thumb, { left: thumbLeft }]} />
          </View>
        </Pressable>
        <View style={styles.clocks}>
          <Text style={type.clock}>{formatClock(current)}</Text>
          <Text style={type.clock}>−{formatClock(duration - current)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reculer de ${SKIP_SECONDS} secondes`}
          onPress={() => seekBy(-SKIP_SECONDS)}
          style={styles.skip}
        >
          <Text style={type.skip}>−{SKIP_SECONDS}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playback.playing ? 'Pause' : 'Lecture'}
          onPress={onToggle}
          style={styles.play}
        >
          {playback.playing ? (
            <PauseIcon size={sizes.playIcon} color={colors.onAccent} />
          ) : (
            <PlayIcon size={sizes.playIcon} color={colors.onAccent} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Avancer de ${SKIP_SECONDS} secondes`}
          onPress={() => seekBy(SKIP_SECONDS)}
          style={styles.skip}
        >
          <Text style={type.skip}>+{SKIP_SECONDS}</Text>
        </Pressable>
      </View>

      {episode.topics.length > 0 && (
        <View style={styles.topics}>
          <View style={styles.topicsTitle}>
            <Overline>AU SOMMAIRE</Overline>
          </View>
          {episode.topics.map((topic) => (
            <View key={topic} style={styles.topic}>
              <Diamond />
              <Text style={[type.body, styles.topicText]}>{topic}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: layout.screenTop,
    paddingHorizontal: layout.gutter,
    paddingBottom: layout.bottomLoose,
    gap: spacing.section,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: sizes.touch, height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  cover: {
    height: sizes.illustrationCover,
    borderRadius: radii.cover,
    overflow: 'hidden',
    backgroundColor: colors.cardBright,
    borderWidth: sizes.hairline,
    borderColor: colors.frame,
  },
  coverTitle: { position: 'absolute', left: 0, right: 0, top: layout.coverTitleTop, textAlign: 'center' },
  titles: { gap: spacing.s },
  centered: { textAlign: 'center' },
  progressBlock: { gap: spacing.m },
  // Zone tactile de 44 px autour d'une barre de 4 px.
  progressHit: { height: sizes.touch, justifyContent: 'center', marginVertical: -(sizes.touch - sizes.progress) / 2 },
  track: { height: sizes.progress, borderRadius: sizes.progress / 2, backgroundColor: colors.track },
  fill: { position: 'absolute', left: 0, top: 0, height: sizes.progress, borderRadius: sizes.progress / 2, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    top: (sizes.progress - sizes.thumb) / 2,
    width: sizes.thumb,
    height: sizes.thumb,
    borderRadius: sizes.thumb / 2,
    backgroundColor: colors.accent,
  },
  clocks: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.skipGap },
  skip: {
    width: sizes.skipButton,
    height: sizes.skipButton,
    borderRadius: sizes.skipButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: sizes.playButton,
    height: sizes.playButton,
    borderRadius: sizes.playButton / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topics: { gap: spacing.xxs },
  topicsTitle: { paddingBottom: spacing.s },
  topic: { minHeight: sizes.topicRow, flexDirection: 'row', alignItems: 'center', gap: spacing.l },
  topicText: { flexShrink: 1 },
});
