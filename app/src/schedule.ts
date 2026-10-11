// Calculs de dates et libellés en français, sans dépendance : testés par
// node --test. Jours au format d'AlarmKit (1 = dimanche … 7 = samedi).
//
// Les noms sont écrits ici plutôt que demandés à Intl : Hermes, sur iPhone,
// ne garantit pas les noms français, et l'aperçu web doit afficher la même
// chose que le téléphone.

export type AlarmSchedule = { hour: number; minute: number; weekdays: number[] };

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
// Ordre d'une semaine française, en numéros AlarmKit.
export const WEEK_ORDER = [2, 3, 4, 5, 6, 7, 1];
const WEEKEND = [7, 1];
const DAYS_IN_WEEK = 7;
const MINUTES_IN_DAY = 24 * 60;
// Une suite de jours consécutifs se dit « du lundi au jeudi » à partir de
// trois jours ; en dessous, on les nomme un par un.
const MIN_RANGE_DAYS = 3;
const SHORT_NAME_LENGTH = 3;

const pad = (n: number) => String(n).padStart(2, '0');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayName = (alarmKitDay: number) => DAY_NAMES[alarmKitDay - 1];
export const dayLetter = (alarmKitDay: number) => dayName(alarmKitDay).charAt(0).toUpperCase();
const shortName = (alarmKitDay: number) => dayName(alarmKitDay).slice(0, SHORT_NAME_LENGTH) + '.';

export function formatTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Décale l'heure en restant dans la journée (23:45 + 15 min → 00:00). */
export function shiftTime(s: AlarmSchedule, minutes: number): AlarmSchedule {
  const total = (((s.hour * 60 + s.minute + minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return { ...s, hour: Math.floor(total / 60), minute: total % 60 };
}

export function toggleDay(s: AlarmSchedule, day: number): AlarmSchedule {
  const weekdays = s.weekdays.includes(day) ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day];
  return { ...s, weekdays: WEEK_ORDER.filter((d) => weekdays.includes(d)) };
}

/** Prochaine sonnerie strictement après `now`, ou null si aucun jour n'est coché. */
export function nextAlarm(s: AlarmSchedule, now: Date): Date | null {
  for (let offset = 0; offset <= DAYS_IN_WEEK; offset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, s.hour, s.minute);
    if (candidate > now && s.weekdays.includes(candidate.getDay() + 1)) return candidate;
  }
  return null;
}

/** « Aujourd'hui », « Demain », ou le nom du jour (« Lundi »). */
export function relativeDay(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return capitalize(dayName(date.getDay() + 1));
}

/** Jours cochés, rangés dans l'ordre de la semaine française. */
function ordered(weekdays: number[]): number[] {
  return WEEK_ORDER.filter((d) => weekdays.includes(d));
}

function isRange(days: number[]): boolean {
  if (days.length < MIN_RANGE_DAYS) return false;
  const first = WEEK_ORDER.indexOf(days[0]);
  return days.every((d, i) => WEEK_ORDER.indexOf(d) === first + i);
}

const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every((d) => a.includes(d));

/** Pour l'Accueil : « du lundi au vendredi », « tous les jours », « le lundi et le jeudi ». */
export function describeDays(weekdays: number[]): string {
  const days = ordered(weekdays);
  if (days.length === 0) return 'aucun jour choisi';
  if (days.length === DAYS_IN_WEEK) return 'tous les jours';
  if (sameDays(days, WEEKEND)) return 'le week-end';
  if (isRange(days)) return `du ${dayName(days[0])} au ${dayName(days[days.length - 1])}`;
  const names = days.map((d) => `le ${dayName(d)}`);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/** Pour les Réglages : « Lun. → ven. », « Tous les jours », « Lun., mer. ». */
export function shortDays(weekdays: number[]): string {
  const days = ordered(weekdays);
  if (days.length === 0) return 'Aucun';
  if (days.length === DAYS_IN_WEEK) return 'Tous les jours';
  if (isRange(days)) return `${capitalize(shortName(days[0]))} → ${shortName(days[days.length - 1])}`;
  return capitalize(days.map(shortName).join(', '));
}

/** « samedi 27 septembre ». */
export function formatDay(date: Date): string {
  return `${dayName(date.getDay() + 1)} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export const formatDayTitle = (date: Date) => capitalize(formatDay(date));

/** « 3 min 28 », comme dans les maquettes. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)} min ${pad(s % 60)}`;
}

/** « 0:42 », pour la barre de lecture. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
