const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/** Texte validé pour le popup système contacts - traductions par locale iOS */
const NS_CONTACTS_BY_LOCALE = {
  fr: 'Cette app envoie les numéros de vos contacts vers les serveurs sécurisés de Prout! pour retrouver automatiquement vos amis. Ces données ne sont pas partagées avec des tiers.',
  es: 'Esta app sube los números de tus contactos a los servidores seguros de Prout! para encontrar automáticamente a tus amigos. Estos datos no se comparten con terceros.',
  pt: 'Este app envia os números dos seus contatos para os servidores seguros do Prout! para encontrar seus amigos automaticamente. Esses dados não são compartilhados com terceiros.',
  de: 'Diese App lädt Telefonnummern aus deinen Kontakten auf die sicheren Server von Prout! hoch, um deine Freunde automatisch zu finden. Diese Daten werden nicht an Dritte weitergegeben.',
  it: "Questa app carica i numeri di telefono dei tuoi contatti sui server sicuri di Prout! per trovare automaticamente i tuoi amici. Questi dati non sono condivisi con terze parti.",
};

/**
 * Plugin Expo pour ajouter les traductions de NSContactsUsageDescription
 * dans InfoPlist.strings pour iOS (fr, es, pt, de, it)
 */
const withIOSContactsLocalization = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      // Le bundle réel peut être "Prout" (expo.name) alors que slug = "ProutApp" ; priorité au dossier qui contient Info.plist
      const possibleAppDirs = [
        path.join(iosProjectRoot, config.name || 'Prout'),
        path.join(iosProjectRoot, config.slug || 'ProutApp'),
        path.join(iosProjectRoot, `${config.slug || 'ProutApp'}App`),
        path.join(iosProjectRoot, 'ProutApp'),
        path.join(iosProjectRoot, 'Prout'),
      ];

      let appDir = possibleAppDirs[0];
      for (const dir of possibleAppDirs) {
        if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'Info.plist'))) {
          appDir = dir;
          break;
        }
      }

      for (const [locale, text] of Object.entries(NS_CONTACTS_BY_LOCALE)) {
        const stringsDir = path.join(appDir, `${locale}.lproj`);
        if (!fs.existsSync(stringsDir)) {
          fs.mkdirSync(stringsDir, { recursive: true });
        }
        const stringsPath = path.join(stringsDir, 'InfoPlist.strings');
        const content = `/* NSContactsUsageDescription (${locale}) */\n"NSContactsUsageDescription" = "${text.replace(/"/g, '\\"')}";\n`;
        fs.writeFileSync(stringsPath, content, 'utf8');
        console.log(`✅ [withIOSContactsLocalization] InfoPlist.strings (${locale}) → ${stringsPath}`);
      }

      return config;
    },
  ]);
};

module.exports = withIOSContactsLocalization;
