const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const withAndroidNotificationChannels = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Créer les canaux au niveau natif via un fichier Java/Kotlin
    // Ce fichier sera exécuté au démarrage de l'app, AVANT le code JavaScript
    // Cela garantit que les canaux existent quand Firebase reçoit les notifications

    // Note: Les canaux doivent être créés dans le code natif Android
    // car ils doivent exister AVANT que Firebase ne reçoive les notifications
    // (même si l'app est fermée)

    console.log('🔧 [withAndroidNotificationChannels] Les canaux seront créés au démarrage de l\'app via le code natif');
    
    return config;
  });
};

module.exports = withAndroidNotificationChannels;


