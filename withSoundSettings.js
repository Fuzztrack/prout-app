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

      // Créer les fichiers directement dans le plugin (plus fiable que copier depuis le repo)
      const soundSettingsModuleContent = `package com.fuzztrack.proutapp

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundSettingsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SoundSettingsModule"
    }

    @ReactMethod
    fun openSoundSettings() {
        val intent = Intent(Settings.ACTION_SOUND_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        reactApplicationContext.startActivity(intent)
    }
}
`;

      const soundSettingsPackageContent = `package com.fuzztrack.proutapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SoundSettingsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(SoundSettingsModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

      // Écrire SoundSettingsModule.kt
      const targetModulePath = path.join(targetDir, 'SoundSettingsModule.kt');
      fs.writeFileSync(targetModulePath, soundSettingsModuleContent, 'utf8');
      console.log('✅ SoundSettingsModule.kt créé dans le build');

      // Écrire SoundSettingsPackage.kt
      const targetPackagePath = path.join(targetDir, 'SoundSettingsPackage.kt');
      fs.writeFileSync(targetPackagePath, soundSettingsPackageContent, 'utf8');
      console.log('✅ SoundSettingsPackage.kt créé dans le build');

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
