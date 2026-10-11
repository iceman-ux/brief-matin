// Alarme de réveil par AlarmKit (iOS 26), via expo-alarm-kit.
import * as AlarmKit from 'expo-alarm-kit';

import {
  ALARM_DISMISS_PAYLOAD,
  ALARM_SOUND_FILE,
  ALARM_TITLE,
  APP_GROUP,
} from '../constants';
import type { AlarmSchedule } from './schedule';
import { readJson, removeJson, writeJson } from './storage';

export type { AlarmSchedule };
type SavedAlarm = AlarmSchedule & { id: string };

// expo-alarm-kit retire une alarme de sa propre liste dès qu'on l'arrête, même
// répétitive (elle reste pourtant programmée dans iOS) : on garde donc nous-
// mêmes l'identifiant de l'alarme du réveil, pour pouvoir la remplacer.
const SAVED_ALARM_KEY = 'alarm';
const TEST_DELAY_SECONDS = 60;

/** Vrai dans l'aperçu web, où alarm.web.ts remplace ce module. */
export const ALARM_SIMULATED = false;

export type AuthorizationStatus = Awaited<ReturnType<typeof AlarmKit.requestAuthorization>>;

/** À appeler une fois au démarrage, avant tout autre appel. */
export function initAlarms(): boolean {
  return AlarmKit.configure(APP_GROUP);
}

export function requestAuthorization(): Promise<AuthorizationStatus> {
  return AlarmKit.requestAuthorization();
}

export function loadSavedAlarm(): SavedAlarm | null {
  return readJson<SavedAlarm>(SAVED_ALARM_KEY);
}

const commonOptions = {
  title: ALARM_TITLE,
  soundName: ALARM_SOUND_FILE,
  launchAppOnDismiss: true,
  dismissPayload: ALARM_DISMISS_PAYLOAD,
};

/** Remplace l'alarme du réveil par une nouvelle, aux jours et à l'heure donnés. */
export async function scheduleWakeUp(schedule: AlarmSchedule): Promise<boolean> {
  const previous = loadSavedAlarm();
  if (previous) await AlarmKit.cancelAlarm(previous.id);
  const id = AlarmKit.generateUUID();
  const ok = await AlarmKit.scheduleRepeatingAlarm({ id, ...schedule, ...commonOptions });
  if (ok) {
    writeJson(SAVED_ALARM_KEY, { id, ...schedule } satisfies SavedAlarm);
  } else {
    removeJson(SAVED_ALARM_KEY);
  }
  return ok;
}

/** Plus aucun jour coché : on retire l'alarme du réveil. */
export async function cancelWakeUp(): Promise<void> {
  const previous = loadSavedAlarm();
  if (previous) await AlarmKit.cancelAlarm(previous.id);
  removeJson(SAVED_ALARM_KEY);
}

export function scheduleTest(): Promise<boolean> {
  return AlarmKit.scheduleAlarm({
    id: AlarmKit.generateUUID(),
    epochSeconds: Math.ceil(Date.now() / 1000) + TEST_DELAY_SECONDS,
    ...commonOptions,
  });
}

/** Alarmes encore connues d'expo-alarm-kit (les ponctuelles pas encore arrêtées). */
export function pendingAlarmIds(): string[] {
  return AlarmKit.getAllAlarms();
}

/**
 * Vrai si l'app vient d'être ouverte par l'arrêt d'une alarme Lora. Le module
 * efface l'information après lecture : un seul appel répond vrai par réveil.
 */
export function consumeAlarmLaunch(): boolean {
  return AlarmKit.getLaunchPayload()?.payload === ALARM_DISMISS_PAYLOAD;
}
