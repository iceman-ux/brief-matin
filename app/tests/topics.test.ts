// Sujets : lecture tolérante, sujet en cours, heure locale.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatCoordinates,
  hasStarts,
  localTime,
  readTopic,
  topicAt,
  topicShortName,
  trendDirection,
} from '../src/topics.ts';

const kyiv = { city: 'Kyiv', country: 'Ukraine', lat: 50.45, lon: 30.52, tz: 'Europe/Kyiv' };

test('un titre seul, venu du cache d’une version précédente', () => {
  assert.deepEqual(readTopic('  Titre '), { title: 'Titre' });
  assert.equal(readTopic(''), null);
  assert.equal(readTopic(42), null);
});

test('débuts : utilisés seulement s’ils sont tous là, dans l’ordre', () => {
  const ok = [{ title: 'a', start: 12 }, { title: 'b', start: 58 }, { title: 'c', start: 101 }];
  assert.equal(hasStarts(ok), true);
  assert.equal(topicAt(ok, 0), null);
  assert.equal(topicAt(ok, 12), 0);
  assert.equal(topicAt(ok, 100), 1);
  assert.equal(topicAt(ok, 500), 2);
  assert.equal(hasStarts([{ title: 'a', start: 12 }, { title: 'b' }]), false);
  assert.equal(hasStarts([{ title: 'a', start: 50 }, { title: 'b', start: 20 }]), false);
  assert.equal(topicAt([{ title: 'a' }], 30), null);
});

test('bouton de sujet : la ville, sinon « Sujet n »', () => {
  assert.equal(topicShortName({ title: 't', place: kyiv }, 0), 'Kyiv');
  assert.equal(topicShortName({ title: 't' }, 2), 'Sujet 3');
});

test('coordonnées et sens de la courbe', () => {
  assert.equal(formatCoordinates(kyiv), '50.45N 30.52E');
  assert.equal(formatCoordinates({ ...kyiv, lat: -22.9, lon: -43.17 }), '22.90S 43.17W');
  assert.equal(trendDirection([1, 3]), '▲');
  assert.equal(trendDirection([3, 1]), '▼');
  assert.equal(trendDirection([2, 2]), '=');
});

test('heure locale : heure du lieu et écart avec le téléphone, rien sans fuseau', () => {
  const now = new Date();
  const line = localTime(kyiv, now);
  assert.match(line ?? '', /^\d\d:\d\d · (même heure|[+−]\d+ h( \d\d)?)$/);
  assert.equal(localTime({ ...kyiv, tz: undefined }, now), null);
  assert.equal(localTime({ ...kyiv, tz: 'Pas/Un_Fuseau' }, now), null);
  const utc = localTime({ ...kyiv, tz: 'UTC' }, new Date(Date.UTC(2026, 9, 12, 5, 30)));
  assert.match(utc ?? '', /^05:30 · /);
});
