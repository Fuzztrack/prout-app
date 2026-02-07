const { withInfoPlist } = require('@expo/config-plugins');

const withIOSAppName = (config) => {
  return withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = "Prrt!";
    return config;
  });
};

module.exports = withIOSAppName;