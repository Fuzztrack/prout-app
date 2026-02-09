const { withInfoPlist } = require('@expo/config-plugins');

const withIOSAppName = (config) => {
  return withInfoPlist(config, (config) => {
    const bundleId = config.ios?.bundleIdentifier;
    const isPrrtBundle = bundleId === 'com.prrt.app';
    const displayName = isPrrtBundle ? 'Prrt!' : 'Prout';

    // Nom affiché iOS (Springboard + dialogues système type OAuth)
    config.modResults.CFBundleDisplayName = displayName;
    // Certains dialogues utilisent aussi CFBundleName
    config.modResults.CFBundleName = displayName;
    return config;
  });
};

module.exports = withIOSAppName;