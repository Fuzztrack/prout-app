/**
 * Config plugin Expo : garantit que les sons custom sont bien déclarés côté
 * expo-notifications (copiés dans le bundle iOS pour APNs / Expo Push).
 *
 * NB: La détection "isIOS" via argv/env peut être fragile selon les environnements.
 * Ici on applique toujours (idempotent) : ça n'impacte pas Android.
 */
const IOS_NOTIFICATION_SOUNDS = [
  './assets/sounds/bzzz1.wav',
  './assets/sounds/bzzz2.wav',
  './assets/sounds/bzzz3.wav',
  './assets/sounds/bzzz4.wav',
  './assets/sounds/bzzz5.wav',
  './assets/sounds/trrl1.wav',
  './assets/sounds/trrl2.wav',
  './assets/sounds/trrl3.wav',
  './assets/sounds/trrl4.wav',
  './assets/sounds/trrl5.wav',
  './assets/sounds/pop1.wav',
  './assets/sounds/pop2.wav',
  './assets/sounds/pop3.wav',
  './assets/sounds/pop4.wav',
  './assets/sounds/pop5.wav',
  './assets/sounds/mood1.wav',
  './assets/sounds/mood2.wav',
  './assets/sounds/mood3.wav',
  './assets/sounds/mood4.wav',
  './assets/sounds/mood5.wav',
  './assets/sounds/toot1.wav',
  './assets/sounds/toot6.wav',
  './assets/sounds/toot8.wav',
  './assets/sounds/toot9.wav',
  './assets/sounds/toot10.wav',
  './assets/sounds/toot13.wav',
  './assets/sounds/toot17.wav',
  './assets/sounds/toot20.wav',
];

function withIOSPrrtSounds(config) {
  const plugins = config.plugins || [];
  const notifIndex = plugins.findIndex(
    (p) => Array.isArray(p) && p[0] === 'expo-notifications'
  );
  if (notifIndex !== -1 && plugins[notifIndex][1]) {
    plugins[notifIndex][1].sounds = IOS_NOTIFICATION_SOUNDS;
    console.log(
      '[withIOSPrrtSounds] sons notifications (bzzz/trrl/pop/mood/toot) configurés.'
    );
  }

  return config;
}

module.exports = withIOSPrrtSounds;
