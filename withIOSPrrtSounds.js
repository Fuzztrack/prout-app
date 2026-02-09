/**
 * Config plugin Expo : pour le build iOS uniquement, remplace les 20 sons prout
 * par les 6 sons prrt présents dans assets/sounds (prrt1, prrt6, prrt8, prrt9, prrt17, prrt18).
 * Android n'est pas modifié.
 */
const IOS_NOTIFICATION_SOUNDS = [
  './assets/sounds/prrt1.wav',
  './assets/sounds/prrt6.wav',
  './assets/sounds/prrt8.wav',
  './assets/sounds/prrt9.wav',
  './assets/sounds/prrt17.wav',
  './assets/sounds/prrt18.wav',
  './assets/sounds/bzzz1.wav',
  './assets/sounds/bzzz2.wav',
  './assets/sounds/trrl1.wav',
  './assets/sounds/trrl2.wav',
  './assets/sounds/trrl3.wav',
];

function withIOSPrrtSounds(config) {
  const isIOS =
    process.argv.some((arg) => arg.includes('ios')) ||
    process.env.EXPO_PUBLIC_PLATFORM === 'ios' ||
    process.env.PLATFORM === 'ios';

  if (isIOS) {
    const plugins = config.plugins || [];
    const notifIndex = plugins.findIndex(
      (p) => Array.isArray(p) && p[0] === 'expo-notifications'
    );
    if (notifIndex !== -1 && plugins[notifIndex][1]) {
      plugins[notifIndex][1].sounds = IOS_NOTIFICATION_SOUNDS;
      console.log(
        '[withIOSPrrtSounds] iOS build: sons notifications (prrt/bzzz/trrl) configurés.'
      );
    }
  }

  return config;
}

module.exports = withIOSPrrtSounds;
