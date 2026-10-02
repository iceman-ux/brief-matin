// Réglages natifs d'AlarmKit, faits ici parce qu'Adam n'a pas de Mac : aucun
// passage par Xcode, tout est régénéré par « expo prebuild » sur EAS.
const fs = require('fs');
const path = require('path');
const {
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
  IOSConfig,
} = require('expo/config-plugins');

/**
 * @param {import('expo/config').ExpoConfig} config
 * @param {{ appGroup: string, usageDescription: string, soundSource: string, soundFile: string }} props
 */
function withLoraAlarm(config, props) {
  config = withInfoPlist(config, (c) => {
    c.modResults.NSAlarmKitUsageDescription = props.usageDescription;
    return c;
  });

  config = withEntitlementsPlist(config, (c) => {
    const key = 'com.apple.security.application-groups';
    const groups = new Set(c.modResults[key] || []);
    groups.add(props.appGroup);
    c.modResults[key] = [...groups];
    return c;
  });

  // Le son d'alarme doit être une ressource du bundle principal : AlarmKit le
  // cherche par son nom (AlertSound.named). On le recopie depuis
  // assets/brand/ à chaque prebuild plutôt que d'en versionner une copie qui
  // finirait par diverger du sonal de production.
  config = withXcodeProject(config, (c) => {
    const projectRoot = c.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const source = path.resolve(projectRoot, props.soundSource);
    if (!fs.existsSync(source)) {
      throw new Error(`Sonal introuvable : ${source}`);
    }
    checkAlarmSound(source);
    const target = path.join(c.modRequest.platformProjectRoot, projectName, props.soundFile);
    fs.copyFileSync(source, target);
    const filepath = path.join(projectName, props.soundFile);
    if (!c.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        isBuildFile: true,
        project: c.modResults,
      });
    }
    return c;
  });

  return config;
}

// iOS remplace en silence par le son par défaut un son d'alerte qui n'est pas
// en PCM linéaire (ou μ-law, a-law, IMA4) ou qui dure 30 s ou plus : on préfère
// que le prebuild échoue que découvrir l'erreur un matin.
const MAX_ALARM_SOUND_SECONDS = 30;
const WAV_ACCEPTED_FORMATS = { 1: 'PCM', 6: 'a-law', 7: 'μ-law' };

function checkAlarmSound(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file} n'est pas un WAV`);
  }
  let format = null;
  let byteRate = null;
  let dataSize = null;
  for (let offset = 12; offset + 8 <= buf.length; ) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      format = buf.readUInt16LE(offset + 8);
      byteRate = buf.readUInt32LE(offset + 16);
    } else if (id === 'data') {
      dataSize = size;
    }
    offset += 8 + size + (size % 2);
  }
  if (!(format in WAV_ACCEPTED_FORMATS)) {
    throw new Error(`${file} : codage WAV ${format} refusé par iOS pour une alarme`);
  }
  const seconds = dataSize / byteRate;
  if (!(seconds < MAX_ALARM_SOUND_SECONDS)) {
    throw new Error(`${file} : ${seconds.toFixed(1)} s, iOS exige moins de ${MAX_ALARM_SOUND_SECONDS} s`);
  }
}

module.exports = withLoraAlarm;
module.exports.checkAlarmSound = checkAlarmSound;
