// Aperçu web : AlarmKit n'existe que sur iPhone. Mêmes fonctions qu'alarm.ts,
// qui enregistrent le réveil sans rien programmer, pour que les écrans se
// comportent comme sur le téléphone.
import type { AlarmSchedule } from './schedule';
import { readJson, removeJson, writeJson } from './storage';

export type { AlarmSchedule };
type SavedAlarm = AlarmSchedule & { id: string };
export type AuthorizationStatus = 'authorized' | 'denied' | 'notDetermined';

const SAVED_ALARM_KEY = 'alarm';
const SIMULATED_ID = 'apercu-web';

export const ALARM_SIMULATED = true;

export function initAlarms(): boolean {
  return true;
}

export async function requestAuthorization(): Promise<AuthorizationStatus> {
  return 'authorized';
}

export function loadSavedAlarm(): SavedAlarm | null {
  return readJson<SavedAlarm>(SAVED_ALARM_KEY);
}

export async function scheduleWakeUp(schedule: AlarmSchedule): Promise<boolean> {
  writeJson(SAVED_ALARM_KEY, { id: SIMULATED_ID, ...schedule } satisfies SavedAlarm);
  return true;
}

export async function cancelWakeUp(): Promise<void> {
  removeJson(SAVED_ALARM_KEY);
}

export async function scheduleTest(): Promise<boolean> {
  return true;
}

export async function scheduleSnooze(_minutes: number): Promise<boolean> {
  return true;
}

export function pendingAlarmIds(): string[] {
  return [];
}

export function consumeAlarmLaunch(): boolean {
  return false;
}
