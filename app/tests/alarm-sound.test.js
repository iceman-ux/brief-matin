// Le sonal de production doit rester accepté par iOS comme son d'alarme :
// sinon AlarmKit sonnerait avec le son par défaut, sans rien signaler.
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const { checkAlarmSound } = require('../plugins/with-lora-alarm');
const { ALARM_SOUND_SOURCE } = require('../constants');

test('le sonal de assets/brand/ est un son d’alarme valable', () => {
  assert.doesNotThrow(() => checkAlarmSound(path.resolve(__dirname, '..', ALARM_SOUND_SOURCE)));
});

test('un fichier qui n’est pas un WAV est refusé', () => {
  assert.throws(() => checkAlarmSound(path.resolve(__dirname, 'fixtures', 'feed.xml')), /pas un WAV/);
});
