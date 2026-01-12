const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin Expo pour garantir que SoundSettingsModule est inclus dans le build
 * Ce plugin copie les fichiers Kotlin et modifie MainApplication.kt dans une seule opération
 * pour garantir l'ordre d'exécution
 */
const withSoundSettings = (config) => {
  // Utiliser withDangerousMod pour copier les fichiers ET modifier MainApplication.kt
  // Cela garantit que les fichiers sont copiés avant que MainApplication.kt ne soit modifié
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

      // Chemins des fichiers sources (dans le repo Git, à la racine du projet)
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
        console.warn('   Vérifiez que le fichier existe dans le repo Git');
      }

      // Copier SoundSettingsPackage.kt
      if (fs.existsSync(sourcePackagePath)) {
        const targetPackagePath = path.join(targetDir, 'SoundSettingsPackage.kt');
        fs.copyFileSync(sourcePackagePath, targetPackagePath);
        console.log('✅ SoundSettingsPackage.kt copié dans le build');
      } else {
        console.warn('⚠️  SoundSettingsPackage.kt source non trouvé:', sourcePackagePath);
        console.warn('   Vérifiez que le fichier existe dans le repo Git');
      }

      // Maintenant modifier MainApplication.kt APRÈS avoir copié les fichiers
      const mainApplicationPath = path.join(
        projectRoot,
        'app/src/main/java/com/fuzztrack/proutapp/MainApplication.kt'
      );

      if (fs.existsSync(mainApplicationPath)) {
        let mainApplication = fs.readFileSync(mainApplicationPath, 'utf8');
        let modified = false;

        // Vérifier si SoundSettingsPackage est déjà importé
        if (!mainApplication.includes('import com.fuzztrack.proutapp.SoundSettingsPackage')) {
          // Chercher la dernière ligne d'import (généralement après expo.modules)
          const lastImportMatch = mainApplication.match(/(import expo\.modules[^\n]+\n)/);
          if (lastImportMatch) {
            // Ajouter après le dernier import expo.modules
            const insertPos = lastImportMatch.index + lastImportMatch[0].length;
            mainApplication =
              mainApplication.slice(0, insertPos) +
              'import com.fuzztrack.proutapp.SoundSettingsPackage\n' +
              mainApplication.slice(insertPos);
            modified = true;
          } else {
            // Si pas d'import expo.modules, chercher le dernier import en général
            const allImports = mainApplication.match(/^import [^\n]+\n/gm);
            if (allImports && allImports.length > 0) {
              const lastImport = allImports[allImports.length - 1];
              const lastImportIndex = mainApplication.lastIndexOf(lastImport);
              const insertPos = lastImportIndex + lastImport.length;
              mainApplication =
                mainApplication.slice(0, insertPos) +
                'import com.fuzztrack.proutapp.SoundSettingsPackage\n' +
                mainApplication.slice(insertPos);
              modified = true;
            }
          }
        }

        // Vérifier si SoundSettingsPackage est déjà ajouté dans getPackages()
        if (!mainApplication.includes('add(SoundSettingsPackage())')) {
          // Chercher la ligne avec PackageList et ajouter SoundSettingsPackage
          const packagesPattern = /(PackageList\(this\)\.packages\.apply\s*\{)/;
          if (packagesPattern.test(mainApplication)) {
            mainApplication = mainApplication.replace(
              packagesPattern,
              "$1\n              add(SoundSettingsPackage())"
            );
            modified = true;
          }
        }

        // Écrire le fichier modifié si nécessaire
        if (modified) {
          fs.writeFileSync(mainApplicationPath, mainApplication, 'utf8');
          console.log('✅ MainApplication.kt modifié avec succès');
        }
      } else {
        console.warn('⚠️  MainApplication.kt non trouvé:', mainApplicationPath);
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withSoundSettings;
