// Navigation entre les quatre écrans, réglages gardés, flux, lecteur et
// alarme. Pas de bibliothèque de navigation : quatre écrans sans pile ni
// historique n'en ont pas besoin.
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { FEED_URL } from './constants';
import {
  ALARM_SIMULATED,
  cancelWakeUp,
  consumeAlarmLaunch,
  initAlarms,
  requestAuthorization,
  scheduleTest,
  scheduleWakeUp,
} from './src/alarm';
import { type Episode, fetchEpisodes } from './src/episodes';
import { downloadEpisode, loadLastEpisode, playableSources, saveLastEpisode } from './src/library';
import type { AlarmSchedule } from './src/schedule';
import { Home } from './src/screens/Home';
import { Player } from './src/screens/Player';
import { Settings } from './src/screens/Settings';
import { Welcome } from './src/screens/Welcome';
import { type Settings as SettingsData, loadSettings, saveSettings } from './src/settings';
import { colors, fontFiles, sizes } from './src/theme';

type Screen = 'welcome' | 'home' | 'player' | 'settings';

// Au démarrage à froid, l'intention d'arrêt d'AlarmKit peut s'exécuter un peu
// après le chargement du JavaScript : on relit le payload une seconde fois.
const LAUNCH_RECHECK_MS = 1500;
// Les − et + des Réglages s'enchaînent : on ne reprogramme l'alarme qu'une
// fois l'heure posée.
const ALARM_APPLY_DELAY_MS = 800;
// Rafraîchit « Aujourd'hui / Demain » sur l'Accueil resté ouvert.
const CLOCK_TICK_MS = 60_000;

const ALARM_DENIED = 'Alarme non autorisée : Réglages iOS › Lora';
const ALARM_FAILED = "L'alarme n'a pas pu être programmée";

initAlarms();

export default function App() {
  const [fontsLoaded] = useFonts(fontFiles);
  const [settings, setSettings] = useState<SettingsData>(loadSettings);
  const [screen, setScreen] = useState<Screen>(() => (settings.onboarded ? 'home' : 'welcome'));
  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    const last = loadLastEpisode();
    return last ? [last] : [];
  });
  const [feedError, setFeedError] = useState<string | null>(null);
  const [alarmProblem, setAlarmProblem] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [current, setCurrent] = useState<Episode | null>(null);
  const [autoplayPending, setAutoplayPending] = useState(false);

  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const loadedGuid = useRef<string | null>(null);
  const alarmQueue = useRef<Promise<unknown>>(Promise.resolve());
  const alarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSettings = useCallback((next: SettingsData) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Les programmations passent l'une après l'autre : deux appels croisés
  // pourraient laisser deux alarmes dans iOS.
  const applyAlarm = useCallback((schedule: AlarmSchedule): Promise<string | null> => {
    const run = alarmQueue.current.then(async () => {
      if (schedule.weekdays.length === 0) {
        await cancelWakeUp();
        return null;
      }
      if ((await requestAuthorization()) !== 'authorized') return ALARM_DENIED;
      return (await scheduleWakeUp(schedule)) ? null : ALARM_FAILED;
    });
    alarmQueue.current = run.catch(() => undefined);
    return run.then(
      (problem) => {
        setAlarmProblem(problem);
        return problem;
      },
      () => {
        setAlarmProblem(ALARM_FAILED);
        return ALARM_FAILED;
      },
    );
  }, []);

  const loadEpisodes = useCallback(async () => {
    try {
      const list = await fetchEpisodes(FEED_URL);
      setFeedError(null);
      if (list.length === 0) return;
      setEpisodes(list);
      saveLastEpisode(list[0]);
      await downloadEpisode(list[0]);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const play = useCallback(
    (episode: Episode) => {
      // On ne recharge la liste que si l'épisode a changé : la recharger en
      // cours de lecture repartirait du début.
      if (loadedGuid.current !== episode.guid) {
        playlist.clear();
        for (const source of playableSources(episode)) playlist.add(source);
        loadedGuid.current = episode.guid;
      }
      playlist.play();
      setCurrent(episode);
      setScreen('player');
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
    checkAlarmLaunch();
    const recheck = setTimeout(checkAlarmLaunch, LAUNCH_RECHECK_MS);
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    loadEpisodes();
    // L'app déjà ouverte en arrière-plan ne redémarre pas quand l'alarme est
    // arrêtée : elle repasse seulement au premier plan.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      checkAlarmLaunch();
      loadEpisodes();
    });
    return () => {
      clearTimeout(recheck);
      clearInterval(tick);
      sub.remove();
    };
  }, [checkAlarmLaunch, loadEpisodes]);

  // Lecture immédiate après l'alarme, avec l'épisode connu (en cache, ou en
  // direct) sans attendre la fin du téléchargement.
  useEffect(() => {
    if (!autoplayPending || episodes.length === 0) return;
    setAutoplayPending(false);
    if (settings.autoplayAfterAlarm && settings.onboarded) play(episodes[0]);
  }, [autoplayPending, episodes, play, settings.autoplayAfterAlarm, settings.onboarded]);

  const onActivate = async () => {
    setActivating(true);
    setWelcomeError(null);
    try {
      // Même refusée, l'alarme ne bloque pas l'app : l'Accueil dit quoi faire.
      await applyAlarm(settings.alarm);
      updateSettings({ ...settings, onboarded: true });
      setScreen('home');
    } catch (e) {
      setWelcomeError(e instanceof Error ? e.message : String(e));
    } finally {
      setActivating(false);
    }
  };

  const onSettingsChange = (next: SettingsData) => {
    updateSettings(next);
    if (next.alarm === settings.alarm) return;
    if (alarmTimer.current) clearTimeout(alarmTimer.current);
    alarmTimer.current = setTimeout(() => applyAlarm(next.alarm), ALARM_APPLY_DELAY_MS);
  };

  const onTestAlarm = async (): Promise<string> => {
    if (ALARM_SIMULATED) return 'Aperçu web : alarme de test simulée.';
    if ((await requestAuthorization()) !== 'authorized') return ALARM_DENIED;
    return (await scheduleTest()) ? 'Alarme de test dans 1 min.' : "Échec de l'alarme de test.";
  };

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.app}>
        {screen === 'welcome' && (
          <Welcome
            schedule={settings.alarm}
            onChange={(alarm) => updateSettings({ ...settings, alarm })}
            onActivate={onActivate}
            busy={activating}
            error={welcomeError}
          />
        )}
        {screen === 'home' && (
          <Home
            alarm={settings.alarm}
            alarmProblem={alarmProblem}
            episodes={episodes}
            feedError={feedError}
            now={now}
            onListen={play}
            onOpenSettings={() => setScreen('settings')}
          />
        )}
        {screen === 'player' && current && (
          <Player
            episode={current}
            playback={{
              playing: status.playing,
              currentTime: status.currentTime,
              duration: status.duration,
              buffering: status.isBuffering,
            }}
            onToggle={() => (status.playing ? playlist.pause() : playlist.play())}
            onSeek={(seconds) => playlist.seekTo(seconds)}
            onClose={() => setScreen('home')}
          />
        )}
        {screen === 'settings' && (
          <Settings
            settings={settings}
            onChange={onSettingsChange}
            onBack={() => setScreen('home')}
            onTestAlarm={onTestAlarm}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  app: { flex: 1, width: '100%', maxWidth: sizes.maxAppWidth },
});
