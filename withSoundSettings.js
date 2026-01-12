const { withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin Expo pour garantir que SoundSettingsModule est inclus dans le build
 * Ce plugin vérifie que les fichiers existent et que la configuration est correcte
 */
const withSoundSettings = (config) => {
  // Vérifier que les fichiers existent
  const soundModulePath = path.join(
    config._internal?.projectRoot || process.cwd(),
    'android/app/src/main/java/com/fuzztrack/proutapp/SoundSettingsModule.kt'
  );
  const soundPackagePath = path.join(
    config._internal?.projectRoot || process.cwd(),
    'android/app/src/main/java/com/fuzztrack/proutapp/SoundSettingsPackage.kt'
  );

  if (!fs.existsSync(soundModulePath)) {
    console.warn('⚠️  SoundSettingsModule.kt non trouvé. Le module ne sera pas disponible.');
  }
  if (!fs.existsSync(soundPackagePath)) {
    console.warn('⚠️  SoundSettingsPackage.kt non trouvé. Le module ne sera pas disponible.');
  }

  // Le module est déjà enregistré dans MainApplication.kt manuellement
  // Ce plugin sert juste à vérifier que les fichiers existent
  return config;
};

module.exports = withSoundSettings;
