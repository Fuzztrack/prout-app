const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Plugin Expo pour ajouter la traduction française de NSContactsUsageDescription
 * dans InfoPlist.strings pour iOS
 */
const withIOSContactsLocalization = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      
      // Trouver le nom de l'app (généralement le slug ou le dernier segment du bundleIdentifier)
      const appName = config.slug || config.ios?.bundleIdentifier?.split('.').pop() || 'ProutApp';
      
      // Chercher le dossier de l'app dans ios/
      // Expo génère généralement ios/[AppName]/ ou ios/[AppName]App/
      const possiblePaths = [
        path.join(iosProjectRoot, appName, 'fr.lproj'),
        path.join(iosProjectRoot, `${appName}App`, 'fr.lproj'),
        path.join(iosProjectRoot, 'ProutApp', 'fr.lproj'),
      ];
      
      // Trouver le premier chemin qui existe (ou utiliser le premier par défaut)
      let stringsDir = possiblePaths[0];
      for (const testPath of possiblePaths) {
        const parentDir = path.dirname(testPath);
        if (fs.existsSync(parentDir)) {
          stringsDir = testPath;
          break;
        }
      }
      
      const stringsPath = path.join(stringsDir, 'InfoPlist.strings');
      
      // Créer le dossier si nécessaire
      if (!fs.existsSync(stringsDir)) {
        fs.mkdirSync(stringsDir, { recursive: true });
        console.log(`📁 [withIOSContactsLocalization] Dossier créé: ${stringsDir}`);
      }
      
      // Contenu du fichier InfoPlist.strings en français
      const frenchContent = `/* 
 * InfoPlist.strings (Français)
 * Traduction française des descriptions d'utilisation des permissions iOS
 */

/* NSContactsUsageDescription */
"NSContactsUsageDescription" = "Cette application envoie de manière sécurisée les numéros de téléphone de vos contacts vers notre serveur uniquement pour identifier vos amis utilisant déjà Prout! et vous permettre de les ajouter. Vos contacts ne sont pas utilisés à des fins commerciales.";
`;

      // Écrire le fichier
      fs.writeFileSync(stringsPath, frenchContent, 'utf8');
      console.log(`✅ [withIOSContactsLocalization] InfoPlist.strings (fr) créé à ${stringsPath}`);
      
      return config;
    },
  ]);
};

module.exports = withIOSContactsLocalization;
