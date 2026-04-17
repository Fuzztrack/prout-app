const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Plugin Expo pour react-native-volume-manager
 * Ce plugin s'assure que le module est correctement lié dans le projet Android
 */
const withVolumeManager = (config) => {
  // Le module devrait être auto-lié, mais on peut ajouter des configurations si nécessaire
  // Pour l'instant, pas de modifications nécessaires car react-native-volume-manager
  // utilise l'auto-linking standard de React Native
  return config;
};

module.exports = withVolumeManager;
