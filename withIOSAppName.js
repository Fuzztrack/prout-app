const { withInfoPlist } = require('@expo/config-plugins');

const withIOSAppName = (config) => {
  return withInfoPlist(config, (config) => {
    // Selon le contexte (prebuild/EAS), `config.ios.bundleIdentifier` peut être absent.
    // On récupère aussi le bundle depuis l'Info.plist si disponible.
    const bundleId = config.ios?.bundleIdentifier || config.modResults?.CFBundleIdentifier;
    const isLegacyProutBundle = bundleId === 'com.fuzztrack.proutapp';
    // Par défaut on force "Proot !" (nouveau bundle), et on ne met "Prout" que si on détecte explicitement l'ancien bundle.
    const displayName = isLegacyProutBundle ? 'Prout' : 'Proot !';

    // Nom affiché iOS (Springboard + dialogues système type OAuth)
    config.modResults.CFBundleDisplayName = displayName;
    // Certains dialogues utilisent aussi CFBundleName
    config.modResults.CFBundleName = displayName;
    return config;
  });
};

module.exports = withIOSAppName;