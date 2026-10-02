// Écran unique de test technique : alarme, téléchargement, lecture. Pas de
// design ici, les maquettes viendront ensuite.
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_ALARM, FEED_URL } from './constants';
import {
  type AlarmSchedule,
  type AuthorizationStatus,
  consumeAlarmLaunch,
  initAlarms,
  loadSavedAlarm,
  pendingAlarmIds,
  requestAuthorization,
  scheduleTest,
  scheduleWakeUp,
} from './src/alarm';
import { type Episode, fetchLatestEpisode } from './src/episodes';
import {
  downloadEpisode,
  isEpisodeCached,
  loadLastEpisode,
  playableSources,
  saveLastEpisode,
} from './src/library';

// Dans l'ordre d'un réveil français, avec la numérotation d'AlarmKit
// (1 = dimanche).
const WEEKDAYS: { label: string; value: number }[] = [
  { label: 'L', value: 2 },
  { label: 'M', value: 3 },
  { label: 'M', value: 4 },
  { label: 'J', value: 5 },
  { label: 'V', value: 6 },
  { label: 'S', value: 7 },
  { label: 'D', value: 1 },
];
// Au démarrage à froid, l'intention d'arrêt d'AlarmKit peut s'exécuter un peu
// après le chargement du JavaScript : on relit le payload une seconde fois.
const LAUNCH_RECHECK_MS = 1500;

const alarmsConfigured = initAlarms();

const pad = (n: number) => String(n).padStart(2, '0');

export default function App() {
  const [schedule, setSchedule] = useState<AlarmSchedule>(() => loadSavedAlarm() ?? DEFAULT_ALARM);
  const [auth, setAuth] = useState<AuthorizationStatus | 'inconnue'>('inconnue');
  const [alarmInfo, setAlarmInfo] = useState('');
  const [episode, setEpisode] = useState<Episode | null>(() => loadLastEpisode());
  const [cached, setCached] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [autoplayPending, setAutoplayPending] = useState(false);

  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const loadedGuid = useRef<string | null>(null);

  const refreshAlarmInfo = useCallback(() => {
    const saved = loadSavedAlarm();
    const daily = saved
      ? `réveil ${pad(saved.hour)}:${pad(saved.minute)} (${saved.weekdays.length} j/sem.)`
      : 'aucun réveil';
    setAlarmInfo(`${daily}, ${pendingAlarmIds().length} alarme(s) ponctuelle(s) en attente`);
  }, []);

  const loadEpisode = useCallback(async () => {
    try {
      const latest = await fetchLatestEpisode(FEED_URL);
      setFeedError(null);
      if (!latest) return;
      saveLastEpisode(latest);
      setEpisode(latest);
      setCached(isEpisodeCached(latest));
      await downloadEpisode(latest);
      setCached(true);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const play = useCallback(
    (ep: Episode) => {
      // On ne recharge la liste que si l'épisode a changé : la recharger en
      // cours de lecture repartirait du début.
      if (loadedGuid.current !== ep.guid) {
        playlist.clear();
        for (const source of playableSources(ep)) playlist.add(source);
        loadedGuid.current = ep.guid;
      }
      playlist.play();
    },
    [playlist],
  );

  const checkAlarmLaunch = useCallback(() => {
    if (consumeAlarmLaunch()) setAutoplayPending(true);
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    refreshAlarmInfo();
    checkAlarmLaunch();
    const recheck = setTimeout(checkAlarmLaunch, LAUNCH_RECHECK_MS);
    loadEpisode();
    // L'app déjà ouverte en arrière-plan ne redémarre pas quand l'alarme est
    // arrêtée : elle repasse seulement au premier plan.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkAlarmLaunch();
      refreshAlarmInfo();
      loadEpisode();
    });
    return () => {
      clearTimeout(recheck);
      sub.remove();
    };
  }, [checkAlarmLaunch, loadEpisode, refreshAlarmInfo]);

  // Lecture immédiate après l'alarme, avec l'épisode connu (en cache, ou en
  // direct) sans attendre la fin du téléchargement.
  useEffect(() => {
    if (autoplayPending && episode) {
      setAutoplayPending(false);
      play(episode);
    }
  }, [autoplayPending, episode, play]);

  const onSchedule = async () => {
    const a = await requestAuthorization();
    setAuth(a);
    if (a !== 'authorized') return;
    const ok = await scheduleWakeUp(schedule);
    setAlarmInfo(ok ? '' : 'échec de la programmation');
    if (ok) refreshAlarmInfo();
  };

  const onTest = async () => {
    const a = await requestAuthorization();
    setAuth(a);
    if (a !== 'authorized') return;
    const ok = await scheduleTest();
    if (ok) refreshAlarmInfo();
    else setAlarmInfo("échec de l'alarme de test");
  };

  const shiftTime = (minutes: number) =>
    setSchedule((s) => {
      const total = (s.hour * 60 + s.minute + minutes + 24 * 60) % (24 * 60);
      return { ...s, hour: Math.floor(total / 60), minute: total % 60 };
    });

  const toggleDay = (day: number) =>
    setSchedule((s) => ({
      ...s,
      weekdays: s.weekdays.includes(day) ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day],
    }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.h1}>Lora — test technique</Text>

      <Text style={styles.h2}>Réveil</Text>
      <View style={styles.row}>
        <Button label="−1 h" onPress={() => shiftTime(-60)} />
        <Button label="−5" onPress={() => shiftTime(-5)} />
        <Text style={styles.time}>
          {pad(schedule.hour)}:{pad(schedule.minute)}
        </Text>
        <Button label="+5" onPress={() => shiftTime(5)} />
        <Button label="+1 h" onPress={() => shiftTime(60)} />
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <Button
            key={d.value}
            label={d.label}
            active={schedule.weekdays.includes(d.value)}
            onPress={() => toggleDay(d.value)}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button label="Programmer" onPress={onSchedule} disabled={schedule.weekdays.length === 0} />
        <Button label="Tester dans 1 min" onPress={onTest} />
      </View>

      <Text style={styles.h2}>Épisode du jour</Text>
      {episode ? (
        <>
          <Text style={styles.text}>{episode.title}</Text>
          <Text style={styles.small}>
            {episode.pubDate.toLocaleString('fr-FR')} · {episode.tracks.length} piste(s)
          </Text>
          <View style={styles.row}>
            <Button
              label={status.playing ? 'Pause' : 'Lecture'}
              onPress={() => (status.playing ? playlist.pause() : play(episode))}
            />
            <Text style={styles.small}>
              {Math.floor(status.currentTime)} s / {Math.floor(status.duration)} s
              {status.isBuffering ? ' · chargement' : ''}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.text}>Aucun épisode chargé.</Text>
      )}

      <Text style={styles.h2}>État</Text>
      <Text style={styles.small}>
        App Group : {alarmsConfigured ? 'ok' : 'INACCESSIBLE'} · autorisation : {auth}
      </Text>
      <Text style={styles.small}>Alarmes : {alarmInfo}</Text>
      <Text style={styles.small}>
        Épisode : {episode ? (cached ? 'en cache' : 'pas en cache, lecture en direct') : '—'}
        {feedError ? ` · flux : ${feedError}` : ''}
      </Text>
    </ScrollView>
  );
}

function Button(props: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[styles.button, props.active && styles.buttonActive, props.disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, gap: 12, backgroundColor: '#0B0E2A', flexGrow: 1 },
  h1: { color: '#F2A33A', fontSize: 22, fontWeight: '600' },
  h2: { color: '#C9953C', fontSize: 17, fontWeight: '600', marginTop: 12 },
  text: { color: '#FFFFFF', fontSize: 15 },
  small: { color: '#C8CAD8', fontSize: 13 },
  time: { color: '#FFFFFF', fontSize: 28, fontVariant: ['tabular-nums'], marginHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#1B2466', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  buttonActive: { backgroundColor: '#8E1426' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 15 },
});
