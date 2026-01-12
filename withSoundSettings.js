const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin Expo pour garantir que SoundSettingsModule est inclus dans le build
 * Ce plugin copie les fichiers Kotlin dans le dossier android généré par prebuild
 */
const withSoundSettings = (config) => {
  // Étape 1 : Copier les fichiers Kotlin dans le dossier android généré
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(
        projectRoot,
        'app/src/main/java/com/fuzztrack/proutapp'
      );

      // Créer le dossier de destination s'il n'existe pas
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Chemins des fichiers sources (dans le repo Git)
      const sourceRoot = config.modRequest.projectRoot;
      const sourceModulePath = path.join(
        sourceRoot,
        'android/app/src/main/java/com/fuzztrack/proutapp/SoundSettingsModule.kt'
      );
      const sourcePackagePath = path.join(
        sourceRoot,
        'android/app/src/main/java/com/fuzztrack/proutapp/SoundSettingsPackage.kt'
      );

      // Copier SoundSettingsModule.kt
      if (fs.existsSync(sourceModulePath)) {
        const targetModulePath = path.join(targetDir, 'SoundSettingsModule.kt');
        fs.copyFileSync(sourceModulePath, targetModulePath);
        console.log('✅ SoundSettingsModule.kt copié dans le build');
      } else {
        console.warn('⚠️  SoundSettingsModule.kt source non trouvé:', sourceModulePath);
      }

      // Copier SoundSettingsPackage.kt
      if (fs.existsSync(sourcePackagePath)) {
        const targetPackagePath = path.join(targetDir, 'SoundSettingsPackage.kt');
        fs.copyFileSync(sourcePackagePath, targetPackagePath);
        console.log('✅ SoundSettingsPackage.kt copié dans le build');
      } else {
        console.warn('⚠️  SoundSettingsPackage.kt source non trouvé:', sourcePackagePath);
      }

      return config;
    },
  ]);

  // Étape 2 : S'assurer que MainApplication.kt enregistre le package
  config = withMainApplication(config, (config) => {
    const mainApplication = config.modResults.contents;

    // Vérifier si SoundSettingsPackage est déjà importé
    if (!mainApplication.includes('import com.fuzztrack.proutapp.SoundSettingsPackage')) {
      // Ajouter l'import après les autres imports com.fuzztrack.proutapp
      const importPattern = /(import com\.fuzztrack\.proutapp\.[^\n]+\n)/g;
      const matches = [...mainApplication.matchAll(importPattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const insertPos = lastMatch.index + lastMatch[0].length;
        config.modResults.contents =
          mainApplication.slice(0, insertPos) +
          'import com.fuzztrack.proutapp.SoundSettingsPackage\n' +
          mainApplication.slice(insertPos);
      } else {
        // Ajouter après les imports expo.modules
        const expoImportIndex = mainApplication.indexOf('import expo.modules');
        if (expoImportIndex !== -1) {
          const insertPos = mainApplication.indexOf('\n', expoImportIndex) + 1;
          config.modResults.contents =
            mainApplication.slice(0, insertPos) +
            'import com.fuzztrack.proutapp.SoundSettingsPackage\n' +
            mainApplication.slice(insertPos);
        }
      }
    }

    // Vérifier si SoundSettingsPackage est déjà ajouté dans getPackages()
    if (!mainApplication.includes('add(SoundSettingsPackage())')) {
      // Chercher la ligne avec PackageList et ajouter SoundSettingsPackage
      const packagesPattern = /(PackageList\(this\)\.packages\.apply\s*\{)/;
      if (packagesPattern.test(mainApplication)) {
        config.modResults.contents = mainApplication.replace(
          packagesPattern,
          "$1\n              add(SoundSettingsPackage())"
        );
      }
    }

    return config;
  });

  return config;
};

module.exports = withSoundSettings;
