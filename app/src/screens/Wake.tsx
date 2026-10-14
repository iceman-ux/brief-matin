// Réveil : l'app vient d'être ouverte par l'alarme (ou peu après). Grande
// heure, sommaire du jour, et un gros bouton qui lance le brief et ouvre le
// Lecteur. « Répéter » reprogramme une sonnerie ; « Arrêter » mène à l'Accueil.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { SNOOZE_MINUTES } from '../../constants';
import { Device } from '../components/Device';
import { Knob } from '../components/Knob';
import { Screen } from '../components/Screen';
import { type Episode, episodeDay, episodeDuration } from '../episodes';
import { useMotion } from '../motion';
import { formatMinutes, formatShortDate } from '../schedule';
import { tintOf, useSkin } from '../skins';
import { sizes, spacing, type } from '../theme';
import { Brand, GhostButton, Label, Lcd, WebNotice } from '../ui';

const BLINK_MS = 500;
const BLINK_LOW = 0.15;
// Lueur d'accent montant du bas de l'écran.
const GLOW = [
  { offset: 0, opacity: 0.24 },
  { offset: 0.55, opacity: 0.05 },
  { offset: 0.78, opacity: 0 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type Props = {
  now: Date;
  episode: Episode | null;
  playing: boolean;
  onListen: () => void;
  onSnooze: () => void;
  onStop: () => void;
};

/** Clignote une fois par seconde, sauf si les animations sont coupées. */
function useBlink() {
  const motion = useMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!motion) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: BLINK_LOW, duration: 0, delay: BLINK_MS, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(value, { toValue: 1, duration: 0, delay: BLINK_MS, useNativeDriver: true, easing: Easing.linear }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion, value]);
  return value;
}

export function Wake({ now, episode, playing, onListen, onSnooze, onStop }: Props) {
  const skin = useSkin();
  const blink = useBlink();
  const duration = episode ? episodeDuration(episode) : null;
  const ready = episode && sameDay(episodeDay(episode), now) ? 'Brief prêt' : episode ? 'Dernier brief' : null;
  const status = ready && [ready, duration !== null && formatMinutes(duration)].filter(Boolean).join(' · ');

  return (
    <Screen
      contentStyle={styles.content}
      backdrop={
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="wakeGlow" cx={0.5} cy={1} rx={0.95} ry={0.4}>
              {GLOW.map((g) => (
                <Stop key={g.offset} offset={g.offset} stopColor={skin.accent} stopOpacity={g.opacity} />
              ))}
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wakeGlow)" />
        </Svg>
      }
    >
      <View style={styles.header}>
        <View style={styles.alarm}>
          <Animated.View style={[styles.alarmDot, { backgroundColor: skin.accent, boxShadow: `0 0 8px ${skin.accent}`, opacity: blink }]} />
          <Label color={skin.accent}>Alarme · {formatShortDate(now)}</Label>
        </View>
        <Brand small />
      </View>

      <Device glow={{ x: 0.5, y: 0.35 }} contentStyle={styles.device}>
        <View style={styles.clock} accessible accessibilityLabel={`Il est ${now.getHours()} h ${pad(now.getMinutes())}`}>
          <Lcd style={type.lcdWake}>{pad(now.getHours())}</Lcd>
          <Animated.View style={{ opacity: blink }}>
            <Lcd style={type.lcdWake}>:</Lcd>
          </Animated.View>
          <Lcd style={type.lcdWake}>{pad(now.getMinutes())}</Lcd>
        </View>
        {status && (
          <Label color={skin.lcd} style={styles.status}>
            {status}
          </Label>
        )}
      </Device>

      <Text style={[type.screenTitle, { color: skin.text }]} accessibilityRole="header">
        Ici Lora,{'\n'}il est l’heure.
      </Text>

      {episode && episode.topics.length > 0 && (
        <View>
          {episode.topics.map((t, i) => (
            <View key={i} style={[styles.topic, i > 0 && { borderTopWidth: sizes.hairline, borderTopColor: skin.line }]}>
              <View style={[styles.dot, { backgroundColor: tintOf(skin, i), boxShadow: `0 0 6px ${tintOf(skin, i)}` }]} />
              <Text numberOfLines={1} style={[type.list, styles.topicText, { color: skin.text }]}>
                {t.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.listen}>
        <Knob
          size={sizes.knobWake}
          iconSize={sizes.iconPlayWake}
          playing={false}
          breathe
          disabled={!episode}
          label={playing ? 'Ouvrir le lecteur' : 'Écouter le brief'}
          onPress={onListen}
        />
        <Text style={[type.wakeCaption, { color: skin.text }]} importantForAccessibility="no" accessibilityElementsHidden>
          {playing ? 'Ouvrir le lecteur' : 'Écouter le brief'}
        </Text>
      </View>

      <View style={styles.actions}>
        <GhostButton label={`Répéter dans ${SNOOZE_MINUTES} minutes`} onPress={onSnooze} style={styles.action}>
          <Text style={[type.button, { color: skin.text2 }]}>Répéter · {SNOOZE_MINUTES} min</Text>
        </GhostButton>
        <GhostButton label="Arrêter" onPress={onStop} style={styles.action}>
          <Text style={[type.button, { color: skin.text2 }]}>Arrêter</Text>
        </GhostButton>
      </View>
      <WebNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.section },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: sizes.mark },
  alarm: { flexDirection: 'row', alignItems: 'center', gap: spacing.ml, flexShrink: 1 },
  alarmDot: { width: sizes.dot, height: sizes.dot, borderRadius: sizes.dot / 2 },
  device: { alignItems: 'center', paddingVertical: spacing.section, gap: spacing.xl },
  clock: { flexDirection: 'row', alignItems: 'center' },
  status: { opacity: 0.8 },
  topic: { minHeight: sizes.touch - spacing.s, flexDirection: 'row', alignItems: 'center', gap: spacing.l },
  dot: { width: sizes.dot, height: sizes.dot, borderRadius: sizes.dot / 2 },
  topicText: { flex: 1 },
  listen: { alignItems: 'center', gap: spacing.block, marginTop: 'auto', paddingTop: spacing.m },
  actions: { flexDirection: 'row', gap: spacing.l },
  action: { flex: 1, minHeight: sizes.wakeButton, borderRadius: sizes.wakeButton / 2 },
});
