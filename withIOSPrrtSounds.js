/**
 * Config plugin Expo : garantit que les sons custom sont bien déclarés côté
 * expo-notifications (copiés dans le bundle iOS pour APNs / Expo Push).
 *
 * NB: La détection "isIOS" via argv/env peut être fragile selon les environnements.
 * Ici on applique toujours (idempotent) : ça n'impacte pas Android.
 */
const IOS_NOTIFICATION_SOUNDS = [
  // Ancienne app iOS "Prout" : sons prout1..20
  './assets/sounds/prout1.wav',
  './assets/sounds/prout2.wav',
  './assets/sounds/prout3.wav',
  './assets/sounds/prout4.wav',
  './assets/sounds/prout5.wav',
  './assets/sounds/prout6.wav',
  './assets/sounds/prout7.wav',
  './assets/sounds/prout8.wav',
  './assets/sounds/prout9.wav',
  './assets/sounds/prout10.wav',
  './assets/sounds/prout11.wav',
  './assets/sounds/prout12.wav',
  './assets/sounds/prout13.wav',
  './assets/sounds/prout14.wav',
  './assets/sounds/prout15.wav',
  './assets/sounds/prout16.wav',
  './assets/sounds/prout17.wav',
  './assets/sounds/prout18.wav',
  './assets/sounds/prout19.wav',
  './assets/sounds/prout20.wav',

  // Nouvelle app iOS "Prrt!" : catégories Soundcheck
  './assets/sounds/prrt1.wav',
  './assets/sounds/prrt6.wav',
  './assets/sounds/prrt8.wav',
  './assets/sounds/prrt9.wav',
  './assets/sounds/prrt17.wav',
  './assets/sounds/prrt18.wav',
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
];

function withIOSPrrtSounds(config) {
  const plugins = config.plugins || [];
  const notifIndex = plugins.findIndex(
    (p) => Array.isArray(p) && p[0] === 'expo-notifications'
  );
  if (notifIndex !== -1 && plugins[notifIndex][1]) {
    plugins[notifIndex][1].sounds = IOS_NOTIFICATION_SOUNDS;
    console.log(
      '[withIOSPrrtSounds] sons notifications (prrt/bzzz/trrl) configurés.'
    );
  }

  return config;
}

module.exports = withIOSPrrtSounds;
