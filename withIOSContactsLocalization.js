const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const CONTACTS_EN =
  "This app uploads phone numbers from your contacts to Prrt!'s secure servers to automatically find your friends. This data is not shared with third parties.";
const CONTACTS_FR =
  'Cette app envoie les numéros de vos contacts vers les serveurs sécurisés de Prrt! pour retrouver automatiquement vos amis. Ces données ne sont pas partagées avec des tiers.';

const PHOTO_EN = 'This app needs access to your photos so you can choose a profile picture.';
const PHOTO_FR =
  "Cette application a besoin d'accéder à vos photos pour vous permettre de choisir une photo de profil.";

const CAMERA_EN = 'This app needs access to your camera so you can take a profile picture.';
const CAMERA_FR =
  "Cette application a besoin d'accéder à votre caméra pour vous permettre de prendre une photo de profil.";

/** Textes de permissions iOS par locale (InfoPlist.strings). */
const PERMISSIONS_BY_LOCALE = {
  // IMPORTANT: Base = fallback iOS. On le met en anglais pour éviter un fallback FR sur appareils EN.
  Base: {
    NSContactsUsageDescription: CONTACTS_EN,
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
  en: {
    NSContactsUsageDescription: CONTACTS_EN,
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
  fr: {
    NSContactsUsageDescription: CONTACTS_FR,
    NSPhotoLibraryUsageDescription: PHOTO_FR,
    NSPhotoLibraryAddUsageDescription: PHOTO_FR,
    NSCameraUsageDescription: CAMERA_FR,
  },
  // Contacts traduits, autres permissions en anglais par défaut
  es: {
    NSContactsUsageDescription:
      'Esta app sube los números de tus contactos a los servidores seguros de Prrt! para encontrar automáticamente a tus amigos. Estos datos no se comparten con terceros.',
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
  pt: {
    NSContactsUsageDescription:
      'Este app envia os números dos seus contatos para os servidores seguros do Prrt! para encontrar seus amigos automaticamente. Esses dados não são compartilhados com terceiros.',
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
  de: {
    NSContactsUsageDescription:
      'Diese App lädt Telefonnummern aus deinen Kontakten auf die sicheren Server von Prrt! hoch, um deine Freunde automatisch zu finden. Diese Daten werden nicht an Dritte weitergegeben.',
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
  it: {
    NSContactsUsageDescription:
      'Questa app carica i numeri di telefono dei tuoi contatti sui server sicuri di Prrt! per trovare automaticamente i tuoi amici. Questi dati non sono condivisi con terze parti.',
    NSPhotoLibraryUsageDescription: PHOTO_EN,
    NSPhotoLibraryAddUsageDescription: PHOTO_EN,
    NSCameraUsageDescription: CAMERA_EN,
  },
};

function escapeStringsValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findIosAppDir(iosProjectRoot, config) {
  const possibleAppDirs = [
    // Dossier iOS courant (Expo prebuild) : souvent le nom du projet Xcode, ex: Prrt
    path.join(iosProjectRoot, 'Prrt'),
    path.join(iosProjectRoot, config.name || ''),
    path.join(iosProjectRoot, (config.name || '').replace(/[^A-Za-z0-9_-]/g, '')),
    path.join(iosProjectRoot, config.slug || ''),
    path.join(iosProjectRoot, `${config.slug || ''}App`),
    path.join(iosProjectRoot, 'ProutApp'),
    path.join(iosProjectRoot, 'Prout'),
  ].filter(Boolean);

  for (const dir of possibleAppDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'Info.plist'))) {
      return dir;
    }
  }

  // Fallback robuste: scanner les dossiers de 1er niveau qui contiennent Info.plist
  try {
    const entries = fs.readdirSync(iosProjectRoot, { withFileTypes: true });
    const candidates = entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(iosProjectRoot, e.name))
      .filter((dir) => fs.existsSync(path.join(dir, 'Info.plist')));

    if (candidates.length === 1) return candidates[0];
    if (candidates.includes(path.join(iosProjectRoot, 'Prrt'))) return path.join(iosProjectRoot, 'Prrt');
    return candidates[0] || null;
  } catch {
    return null;
  }
}

/**
 * Plugin Expo pour ajouter les traductions de permissions iOS
 * dans InfoPlist.strings (Base/en/fr/es/pt/de/it).
 */
const withIOSContactsLocalization = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      const appDir = findIosAppDir(iosProjectRoot, config);
      if (!appDir) {
        console.warn(
          `⚠️ [withIOSContactsLocalization] Impossible de trouver le dossier iOS contenant Info.plist dans ${iosProjectRoot}.`
        );
        return config;
      }

      for (const [locale, strings] of Object.entries(PERMISSIONS_BY_LOCALE)) {
        const stringsDir = path.join(appDir, `${locale}.lproj`);
        if (!fs.existsSync(stringsDir)) {
          fs.mkdirSync(stringsDir, { recursive: true });
        }
        const stringsPath = path.join(stringsDir, 'InfoPlist.strings');
        const lines = [
          `/* Generated by withIOSContactsLocalization (${locale}) */`,
          `"NSContactsUsageDescription" = "${escapeStringsValue(strings.NSContactsUsageDescription)}";`,
          `"NSPhotoLibraryUsageDescription" = "${escapeStringsValue(strings.NSPhotoLibraryUsageDescription)}";`,
          `"NSPhotoLibraryAddUsageDescription" = "${escapeStringsValue(strings.NSPhotoLibraryAddUsageDescription)}";`,
          `"NSCameraUsageDescription" = "${escapeStringsValue(strings.NSCameraUsageDescription)}";`,
          '',
        ];
        const content = lines.join('\n');
        fs.writeFileSync(stringsPath, content, 'utf8');
        console.log(`✅ [withIOSContactsLocalization] InfoPlist.strings (${locale}) → ${stringsPath}`);
      }

      return config;
    },
  ]);
};

module.exports = withIOSContactsLocalization;
