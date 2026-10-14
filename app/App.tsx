// Navigation entre les cinq écrans, réglages gardés, flux, lecteur et
// alarme. Pas de bibliothèque de navigation : cinq écrans sans pile ni
// historique n'en ont pas besoin.
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FEED_URL, SNOOZE_MINUTES, WAKE_SCREEN_MINUTES } from './constants';
import {
  ALARM_SIMULATED,
  cancelWakeUp,
  consumeAlarmLaunch,
  initAlarms,
  loadSavedAlarm,
  requestAuthorization,
  scheduleSnooze,
  scheduleTest,
  scheduleWakeUp,
} from './src/alarm';
import { type Episode, fetchEpisodes } from './src/episodes';
import { downloadEpisode, loadLastEpisode, mayDownload, playableSources, saveLastEpisode } from './src/library';
import { MotionProvider } from './src/motion';
import { PREVIEW } from './src/preview';
import { type AlarmSchedule, previousAlarm } from './src/schedule';
import { Home } from './src/screens/Home';
import { type Playback, Player } from './src/screens/Player';
import { Settings } from './src/screens/Settings';
import { Wake } from './src/screens/Wake';
import { Welcome } from './src/screens/Welcome';
import { type Settings as SettingsData, loadSettings, saveSettings } from './src/settings';
import { SKINS, SkinProvider } from './src/skins';
import { readJson, writeJson } from './src/storage';
import { fontFiles, sizes } from './src/theme';

type Screen = 'welcome' | 'wake' | 'home' | 'player' | 'settings';

// Au démarrage à froid, l'intention d'arrêt d'AlarmKit peut s'exécuter un peu
// après le chargement du JavaScript : on relit le payload une seconde fois.
const LAUNCH_RECHECK_MS = 1500;
// Les − et + des Réglages s'enchaînent : on ne reprogramme l'alarme qu'une
// fois l'heure posée.
const ALARM_APPLY_DELAY_MS = 800;
// Rafraîchit l'heure de l'écran Réveil et « prochain réveil ».
const CLOCK_TICK_MS = 15_000;
// Sonnerie dont l'écran Réveil a déjà été montré : il ne revient pas à
// chaque retour au premier plan.
const WAKE_SEEN_KEY = 'wake-seen';

const ALARM_DENIED = 'Alarme non autorisée : Réglages iOS › Lora';
const ALARM_FAILED = "L'alarme n'a pas pu être programmée";

initAlarms();

/** Sonnerie récente (moins de WAKE_SCREEN_MINUTES) pas encore saluée par l'écran Réveil. */
function recentAlarm(schedule: AlarmSchedule, now: Date): Date | null {
  if (!loadSavedAlarm()) return null;
  const last = previousAlarm(schedule, now);
  if (!last || now.getTime() - last.getTime() > WAKE_SCREEN_MINUTES * 60_000) return null;
  return readJson<number>(WAKE_SEEN_KEY) === last.getTime() ? null : last;
}

export default function App() {
  const [fontsLoaded] = useFonts(fontFiles);
  const [settings, setSettings] = useState<SettingsData>(loadSettings);
  const [screen, setScreen] = useState<Screen>(() => PREVIEW.screen ?? (settings.onboarded ? 'home' : 'welcome'));
  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    if (PREVIEW.demo) return [PREVIEW.demo];
    const last = loadLastEpisode();
    return last ? [last] : [];
  });
  const [feedError, setFeedError] = useState<string | null>(null);
  const [alarmProblem, setAlarmProblem] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [current, setCurrent] = useState<Episode | null>(null);
  const [rate, setRate] = useState(1);
  const [alarmLaunch, setAlarmLaunch] = useState(false);
  const [autoplayPending, setAutoplayPending] = useState(false);
  const [previewPlay, setPreviewPlay] = useState(PREVIEW.playAt);

  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const loadedGuid = useRef<string | null>(null);
  // Lu par loadEpisodes, appelé hors rendu (retour au premier plan).
  const allowCellular = useRef(settings.downloadOnCellular);
  allowCellular.current = settings.downloadOnCellular;
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
      // Démonstration : l'épisode de démo reste en tête, le flux fournit l'historique.
      if (PREVIEW.demo) {
        const demo = PREVIEW.demo;
        setEpisodes([demo, ...list.filter((e) => e.guid !== demo.guid)]);
        return;
      }
      setEpisodes(list);
      saveLastEpisode(list[0]);
      if (await mayDownload(allowCellular.current)) await downloadEpisode(list[0]);
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const load = useCallback(
    (episode: Episode) => {
      // On ne recharge la liste que si l'épisode a changé : la recharger en
      // cours de lecture repartirait du début.
      if (loadedGuid.current === episode.guid) return;
      playlist.clear();
      for (const source of playableSources(episode)) playlist.add(source);
      playlist.playbackRate = rate;
      loadedGuid.current = episode.guid;
      setCurrent(episode);
    },
    [playlist, rate],
  );

  const play = useCallback(
    (episode: Episode, options: { at?: number; open?: boolean } = {}) => {
      load(episode);
      playlist.play();
      if (options.at !== undefined) playlist.seekTo(options.at);
      if (options.open) setScreen('player');
    },
    [load, playlist],
  );

  const pause = useCallback(() => playlist.pause(), [playlist]);

  const toggle = (episode: Episode) => {
    if (loadedGuid.current === episode.guid && status.playing) pause();
    else play(episode);
  };

  const openPlayer = (episode: Episode) => {
    load(episode);
    setScreen('player');
  };

  const checkWake = useCallback(() => {
    if (consumeAlarmLaunch()) setAlarmLaunch(true);
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    checkWake();
    const recheck = setTimeout(checkWake, LAUNCH_RECHECK_MS);
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    loadEpisodes();
    // L'app déjà ouverte en arrière-plan ne redémarre pas quand l'alarme est
    // arrêtée : elle repasse seulement au premier plan.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      checkWake();
      loadEpisodes();
    });
    return () => {
      clearTimeout(recheck);
      clearInterval(tick);
      sub.remove();
    };
  }, [checkWake, loadEpisodes]);

  // Écran Réveil : ouvert par l'alarme, ou dans les WAKE_SCREEN_MINUTES qui
  // suivent une sonnerie.
  useEffect(() => {
    if (!settings.onboarded || PREVIEW.screen) return;
    const recent = recentAlarm(settings.alarm, now);
    if (!alarmLaunch && !recent) return;
    const ring = recent ?? previousAlarm(settings.alarm, now);
    if (ring) writeJson(WAKE_SEEN_KEY, ring.getTime());
    setScreen('wake');
    if (!alarmLaunch) return;
    setAlarmLaunch(false);
    setAutoplayPending(settings.autoplayAfterAlarm);
  }, [alarmLaunch, now, settings.alarm, settings.autoplayAfterAlarm, settings.onboarded]);

  // Lecture dès l'alarme si le réglage le veut, avec l'épisode connu (en
  // cache, ou en direct) sans attendre la fin du téléchargement.
  useEffect(() => {
    if (!autoplayPending || episodes.length === 0) return;
    setAutoplayPending(false);
    play(episodes[0]);
  }, [autoplayPending, episodes, play]);

  // Aperçu web : ?lecture=58 lance le brief à cette position.
  useEffect(() => {
    if (previewPlay === null || episodes.length === 0) return;
    setPreviewPlay(null);
    play(episodes[0], { at: previewPlay });
  }, [previewPlay, episodes, play]);

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

  const onSnooze = async () => {
    pause();
    setScreen('home');
    if (!(await scheduleSnooze(SNOOZE_MINUTES))) setAlarmProblem(ALARM_FAILED);
  };

  const onRate = (next: number) => {
    playlist.playbackRate = next;
    setRate(next);
  };

  const skinName = PREVIEW.skin ?? settings.skin;
  const skin = SKINS[skinName];
  if (!fontsLoaded) return <View style={[styles.root, { backgroundColor: skin.bg }]} />;

  const playback: Playback = {
    guid: current?.guid ?? null,
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
    buffering: status.isBuffering,
    rate,
  };
  const today = episodes[0] ?? null;

  return (
    <SafeAreaProvider>
      <SkinProvider name={skinName}>
        <MotionProvider enabled={settings.animations}>
          <View style={[styles.root, { backgroundColor: skin.bg }]}>
            <StatusBar style={skin.statusBar} />
            <View style={styles.app}>
              {screen === 'welcome' && (
                <Welcome
                  schedule={settings.alarm}
                  onChange={(alarm) => updateSettings({ ...settings, alarm })}
                  onActivate={onActivate}
                  busy={activating}
                  error={welcomeError}
                  places={today?.topics.map((t) => t.place) ?? []}
                />
              )}
              {screen === 'wake' && (
                <Wake
                  now={now}
                  episode={today}
                  playing={status.playing && current?.guid === today?.guid}
                  onListen={() => today && play(today, { open: true })}
                  onSnooze={onSnooze}
                  onStop={() => {
                    pause();
                    setScreen('home');
                  }}
                />
              )}
              {screen === 'home' && (
                <Home
                  alarm={settings.alarm}
                  alarmProblem={alarmProblem}
                  episodes={episodes}
                  feedError={feedError}
                  now={now}
                  playback={playback}
                  demo={PREVIEW.demo !== null}
                  onToggle={toggle}
                  onPlayAt={(episode, at) => play(episode, { at })}
                  onSeek={(seconds) => playlist.seekTo(seconds)}
                  onOpenPlayer={openPlayer}
                  onOpenSettings={() => setScreen('settings')}
                  initialTopic={PREVIEW.topic}
                  initialSheet={PREVIEW.sheet}
                />
              )}
              {screen === 'player' && (current ?? today) && (
                <Player
                  episode={(current ?? today) as Episode}
                  playback={playback}
                  now={now}
                  onToggle={() => (status.playing ? pause() : play((current ?? today) as Episode))}
                  onSeek={(seconds) => {
                    load((current ?? today) as Episode);
                    playlist.seekTo(seconds);
                  }}
                  onRate={onRate}
                  onClose={() => setScreen('home')}
                />
              )}
              {screen === 'settings' && (
                <Settings
                  settings={settings}
                  onChange={onSettingsChange}
                  onBack={() => setScreen('home')}
                  onTestAlarm={onTestAlarm}
                  lastEpisode={today}
                />
              )}
            </View>
          </View>
        </MotionProvider>
      </SkinProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  app: { flex: 1, width: '100%', maxWidth: sizes.maxAppWidth },
});
