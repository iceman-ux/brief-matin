// Tests du parseur de flux, sur une copie figée de docs/feed.xml (02/10/2026).
// Lancement : npm test (node --test, sans dépendance : Node 24 lit le
// TypeScript tel quel).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { latestEpisode, parseDuration, parseFeed } from '../src/episodes.ts';

const feed = readFileSync(new URL('./fixtures/feed.xml', import.meta.url), 'utf8');

test('le flux réel donne ses onze épisodes, du plus récent au plus ancien', () => {
  const episodes = parseFeed(feed);
  assert.equal(episodes.length, 11);
  for (let i = 1; i < episodes.length; i++) {
    assert.ok(episodes[i - 1].pubDate >= episodes[i].pubDate);
  }
});

test("l'épisode du jour : titre, date, URL de la Release, durée", () => {
  const episode = latestEpisode(feed);
  assert.ok(episode);
  assert.equal(episode.title, '02/10 — Bardella visé par des révélations');
  assert.equal(episode.guid, 'brief-matin-2026-10-02');
  assert.equal(episode.pubDate.toISOString(), '2026-10-02T08:55:04.000Z');
  assert.equal(episode.tracks.length, 1);
  assert.deepEqual(episode.tracks[0], {
    url: 'https://github.com/iceman-ux/brief-matin/releases/download/episodes/brief-2026-10-02.mp3',
    title: '02/10 — Bardella visé par des révélations',
    durationSec: 199,
    sizeBytes: 2392756,
  });
});

test("l'ordre ne dépend pas de l'ordre des <item> dans le flux", () => {
  const item = (day: string) =>
    `<item><title>${day}</title><pubDate>${day} Oct 2026 08:00:00 +0000</pubDate>` +
    `<enclosure url="https://exemple.org/${day}.mp3" length="10" type="audio/mpeg"/></item>`;
  const xml = `<rss><channel>${item('01')}${item('03')}${item('02')}</channel></rss>`;
  assert.equal(latestEpisode(xml)?.title, '03');
});

test('entités, CDATA et attributs entre apostrophes', () => {
  const xml =
    '<rss><channel><item><title><![CDATA[Budget & dette <direct>]]></title>' +
    '<pubDate>Fri, 02 Oct 2026 08:55:04 +0000</pubDate>' +
    "<enclosure type='audio/mpeg' url='https://exemple.org/a.mp3?x=1&amp;y=2'/>" +
    '<itunes:duration>1:02:03</itunes:duration></item></channel></rss>';
  const episode = latestEpisode(xml);
  assert.equal(episode?.title, 'Budget & dette <direct>');
  assert.equal(episode?.tracks[0].url, 'https://exemple.org/a.mp3?x=1&y=2');
  assert.equal(episode?.tracks[0].durationSec, 3723);
  assert.equal(episode?.tracks[0].sizeBytes, null);
});

test('un item sans enclosure ou sans date est ignoré', () => {
  const xml =
    '<rss><channel>' +
    '<item><title>sans audio</title><pubDate>Fri, 02 Oct 2026 08:55:04 +0000</pubDate></item>' +
    '<item><title>sans date</title><enclosure url="https://exemple.org/a.mp3"/></item>' +
    '</channel></rss>';
  assert.deepEqual(parseFeed(xml), []);
  assert.equal(latestEpisode(xml), null);
});

test('durées', () => {
  assert.equal(parseDuration('3:19'), 199);
  assert.equal(parseDuration('199'), 199);
  assert.equal(parseDuration('1:00:00'), 3600);
  assert.equal(parseDuration('trois minutes'), null);
  assert.equal(parseDuration(null), null);
});
