import type { ExpoConfig } from 'expo/config';

import {
  ALARM_SOUND_FILE,
  ALARM_SOUND_SOURCE,
  ALARM_USAGE_DESCRIPTION,
  APP_GROUP,
  BUNDLE_ID,
  IOS_DEPLOYMENT_TARGET,
} from './constants';

const config: ExpoConfig = {
  name: 'Lora',
  slug: 'lora',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  // AlarmKit n'existe que sur iOS : pas de version Android prévue.
  platforms: ['ios'],
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    deploymentTarget: IOS_DEPLOYMENT_TARGET,
    infoPlist: {
      // Exemption de chiffrement : l'app n'utilise que HTTPS, ce qui évite la
      // question à chaque envoi sur TestFlight.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    [
      'expo-audio',
      {
        microphonePermission: false,
        enableBackgroundPlayback: true,
      },
    ],
    [
      './plugins/with-lora-alarm',
      {
        appGroup: APP_GROUP,
        usageDescription: ALARM_USAGE_DESCRIPTION,
        soundSource: ALARM_SOUND_SOURCE,
        soundFile: ALARM_SOUND_FILE,
      },
    ],
  ],
};

export default config;
