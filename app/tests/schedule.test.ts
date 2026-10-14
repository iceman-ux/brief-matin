// Prochain réveil et libellés de jours. Jours au format AlarmKit : 1 =
// dimanche … 7 = samedi. Le 11/10/2026 est un dimanche.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeDays,
  formatClock,
  formatDay,
  formatDuration,
  nextAlarm,
  relativeDay,
  shiftTime,
  shortDays,
  toggleDay,
} from '../src/schedule.ts';

const WEEKDAYS = [2, 3, 4, 5, 6];
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

test('prochain réveil : le dimanche soir, ce sera lundi', () => {
  const next = nextAlarm({ hour: 7, minute: 0, weekdays: WEEKDAYS }, at(11, 22));
  assert.deepEqual(next, at(12, 7));
});

test("prochain réveil : avant l'heure, c'est aujourd'hui ; à l'heure pile, c'est demain", () => {
  const s = { hour: 7, minute: 0, weekdays: WEEKDAYS };
  assert.deepEqual(nextAlarm(s, at(12, 6, 59)), at(12, 7));
  assert.deepEqual(nextAlarm(s, at(12, 7)), at(13, 7));
});

test('prochain réveil : le vendredi après le réveil, on saute le week-end', () => {
  assert.deepEqual(nextAlarm({ hour: 7, minute: 0, weekdays: WEEKDAYS }, at(16, 8)), at(19, 7));
});

test('prochain réveil : un seul jour, déjà passé, revient une semaine plus tard', () => {
  assert.deepEqual(nextAlarm({ hour: 7, minute: 0, weekdays: [2] }, at(12, 8)), at(19, 7));
});

test('prochain réveil : aucun jour coché', () => {
  assert.equal(nextAlarm({ hour: 7, minute: 0, weekdays: [] }, at(12, 8)), null);
});

test("aujourd'hui, demain, ou le nom du jour", () => {
  const now = at(11, 22);
  assert.equal(relativeDay(at(11, 23), now), "Aujourd'hui");
  assert.equal(relativeDay(at(12, 7), now), 'Demain');
  assert.equal(relativeDay(at(14, 7), now), 'Mercredi');
});

test('jours en toutes lettres et en abrégé', () => {
  assert.equal(describeDays(WEEKDAYS), 'du lundi au vendredi');
  assert.equal(shortDays(WEEKDAYS), 'Lun. → ven.');
  assert.equal(describeDays([1, 2, 3, 4, 5, 6, 7]), 'tous les jours');
  assert.equal(describeDays([1, 7]), 'le week-end');
  assert.equal(describeDays([6, 2]), 'le lundi et le vendredi');
  assert.equal(shortDays([4, 2, 6]), 'Lun., mer., ven.');
  // Une suite qui traverse le dimanche se lit dans l'ordre français.
  assert.equal(describeDays([7, 1, 2]), 'le lundi, le samedi et le dimanche');
  assert.equal(shortDays([]), 'Aucun');
});

test('heure par pas, sans sortir de la journée', () => {
  const s = { hour: 23, minute: 45, weekdays: WEEKDAYS };
  assert.deepEqual(shiftTime(s, 15), { ...s, hour: 0, minute: 0 });
  assert.deepEqual(shiftTime({ ...s, hour: 0, minute: 0 }, -15), s);
});

test('cocher un jour garde l’ordre de la semaine', () => {
  const s = { hour: 7, minute: 0, weekdays: [6, 2] };
  assert.deepEqual(toggleDay(s, 1).weekdays, [2, 6, 1]);
  assert.deepEqual(toggleDay(s, 6).weekdays, [2]);
});

test('formats des maquettes', () => {
  assert.equal(formatDay(new Date(2026, 8, 27)), 'dimanche 27 septembre');
  assert.equal(formatDuration(208), '3 min 28');
  assert.equal(formatDuration(184), '3 min 04');
  assert.equal(formatClock(42), '0:42');
  assert.equal(formatClock(166), '2:46');
});

test('résumé des jours sous l’heure LCD', async () => {
  const { daysSummary } = await import('../src/schedule.ts');
  assert.equal(daysSummary(WEEKDAYS), 'En semaine');
  assert.equal(daysSummary([1, 2, 3, 4, 5, 6, 7]), 'Tous les jours');
  assert.equal(daysSummary([]), 'Désactivé');
  assert.equal(daysSummary([2, 4, 6]), '3 jours');
  assert.equal(daysSummary([7]), 'Samedi');
});

test('dates courtes de l’écran Réveil et du Lecteur', async () => {
  const { formatShortDate, formatDayMonth, formatLcd, formatMinutes, formatStamp } = await import('../src/schedule.ts');
  assert.equal(formatShortDate(at(12, 7)), 'lun. 12 oct.');
  assert.equal(formatShortDate(new Date(2026, 5, 2)), 'mar. 2 juin');
  assert.equal(formatDayMonth(at(12, 7)), '12 octobre');
  assert.equal(formatLcd(58), '00:58');
  assert.equal(formatLcd(184), '03:04');
  assert.equal(formatMinutes(184), '3 min');
  assert.equal(formatMinutes(10), '1 min');
  assert.equal(formatStamp(at(12, 4, 5)), '12.10 · 04:05');
});

test('dernière sonnerie : celle du matin même, ou la précédente', async () => {
  const { previousAlarm } = await import('../src/schedule.ts');
  const s = { hour: 7, minute: 0, weekdays: WEEKDAYS };
  assert.deepEqual(previousAlarm(s, at(12, 7, 5)), at(12, 7));
  assert.deepEqual(previousAlarm(s, at(12, 6, 59)), at(9, 7));
  assert.equal(previousAlarm({ ...s, weekdays: [] }, at(12, 8)), null);
});
