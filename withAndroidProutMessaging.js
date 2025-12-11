const fs = require('fs');
const path = require('path');
const { 
  withAndroidManifest, 
  withDangerousMod,
  withGradleProperties,
  withAppBuildGradle 
} = require('@expo/config-plugins');

// Chemin source : utiliser temp_native_backup ou android/ selon ce qui existe
const PROUT_SERVICE_BACKUP = path.join(__dirname, 'temp_native_backup/ProutMessagingService.kt');
const PROUT_SERVICE_SOURCE = path.join(__dirname, 'android/app/src/main/java/com/fuzztrack/proutapp/ProutMessagingService.kt');
const TARGET_SERVICE_PATH = 'android/app/src/main/java/com/fuzztrack/proutapp/ProutMessagingService.kt';

const withAndroidProutMessaging = (config) => {
  // 1. Ajouter le service dans le manifest
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ajouter namespace tools si absent
    if (!androidManifest.manifest.$) {
      androidManifest.manifest.$ = {};
    }
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    
    // Ajouter permission RECORD_AUDIO avec remove
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    // Supprimer les doublons de RECORD_AUDIO
    androidManifest.manifest['uses-permission'] = androidManifest.manifest['uses-permission'].filter(
      (perm) => !(perm.$ && perm.$['android:name'] === 'android.permission.RECORD_AUDIO')
    );
    
    // Ajouter la permission avec tools:node="remove"
    androidManifest.manifest['uses-permission'].push({
      $: {
        'android:name': 'android.permission.RECORD_AUDIO',
        'tools:node': 'remove',
      },
    });
    
    const mainApplication = androidManifest.manifest.application[0];
    
    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    
    // Supprimer les doublons du service
    mainApplication.service = mainApplication.service.filter(
      (service) => !(service.$ && service.$['android:name'] === '.ProutMessagingService')
    );
    
    // Ajouter le service ProutMessagingService
    mainApplication.service.push({
      $: {
        'android:name': '.ProutMessagingService',
        'android:exported': 'false',
      },
      'intent-filter': [{
        action: [{
          $: {
            'android:name': 'com.google.firebase.MESSAGING_EVENT',
          },
        }],
      }],
    });
    
    console.log('🔧 [withAndroidProutMessaging] Service ajouté au manifest');
    return config;
  });

  // 2. Copier le fichier ProutMessagingService.kt
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const targetPath = path.join(config.modRequest.platformProjectRoot, TARGET_SERVICE_PATH);
      const targetDir = path.dirname(targetPath);
      
      // Créer le dossier si nécessaire
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Copier le fichier source vers la destination (priorité au backup, puis android/)
      let sourcePath = null;
      if (fs.existsSync(PROUT_SERVICE_BACKUP)) {
        sourcePath = PROUT_SERVICE_BACKUP;
      } else if (fs.existsSync(PROUT_SERVICE_SOURCE)) {
        sourcePath = PROUT_SERVICE_SOURCE;
      }
      
      if (sourcePath) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ [withAndroidProutMessaging] ProutMessagingService.kt copié depuis ${sourcePath} vers ${targetPath}`);
      } else {
        console.warn(`⚠️ [withAndroidProutMessaging] Aucun fichier source trouvé (backup: ${PROUT_SERVICE_BACKUP}, source: ${PROUT_SERVICE_SOURCE})`);
      }
      
      return config;
    },
  ]);

  // 3. Ajouter les dépendances Firebase dans build.gradle
  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    // Vérifier si les dépendances Firebase sont déjà présentes
    if (!buildGradle.includes('com.google.firebase:firebase-bom')) {
      // Trouver la section dependencies
      const dependenciesIndex = buildGradle.indexOf('dependencies {');
      if (dependenciesIndex !== -1) {
        // Insérer les dépendances Firebase après la première ligne de dependencies
        const insertIndex = buildGradle.indexOf('\n', dependenciesIndex) + 1;
        const firebaseDeps = `
    // Firebase Cloud Messaging (pour ProutMessagingService)
    implementation(platform("com.google.firebase:firebase-bom:33.2.0"))
    implementation("com.google.firebase:firebase-messaging")
`;
        buildGradle = buildGradle.slice(0, insertIndex) + firebaseDeps + buildGradle.slice(insertIndex);
        
        // Vérifier si le plugin google-services est déjà appliqué
        if (!buildGradle.includes("apply plugin: 'com.google.gms.google-services'")) {
          buildGradle += "\napply plugin: 'com.google.gms.google-services'";
        }
        
        console.log('✅ [withAndroidProutMessaging] Dépendances Firebase ajoutées dans build.gradle');
      }
    }
    
    config.modResults.contents = buildGradle;
    return config;
  });

  return config;
};

module.exports = withAndroidProutMessaging;

