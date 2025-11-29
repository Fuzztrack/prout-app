const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidNotificationMetadata = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ajoute le namespace tools si absent
    if (!androidManifest.manifest.$) {
      androidManifest.manifest.$ = {};
    }
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    
    const mainApplication = androidManifest.manifest.application[0];
    
    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }

    // On supprime les doublons éventuels pour les deux meta-data
    mainApplication['meta-data'] = mainApplication['meta-data'].filter(
      (item) => 
        item.$['android:name'] !== 'com.google.firebase.messaging.default_notification_channel_id' &&
        item.$['android:name'] !== 'com.google.firebase.messaging.default_notification_color'
    );

    // On injecte notre canal par défaut (V14) avec tools:replace pour éviter les conflits
    mainApplication['meta-data'].push({
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
        'android:value': 'prout1-v14', // Doit matcher le code JS
        'tools:replace': 'android:value', // Résout les conflits avec react-native-firebase
      },
    });

    // On injecte la couleur de notification avec tools:replace pour éviter les conflits
    mainApplication['meta-data'].push({
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_color',
        'android:resource': '@color/white', // Couleur blanche pour les notifications
        'tools:replace': 'android:resource', // Résout les conflits avec react-native-firebase
      },
    });

    console.log('🔧 [withAndroidNotificationMetadata] Meta-data injectées avec tools:replace (channel_id + color)');
    return config;
  });
};

module.exports = withAndroidNotificationMetadata;

