// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Bloquer tous les TS/TSX dans node_modules sauf ceux nécessaires
config.resolver.blockList = exclusionList([
  /node_modules\/.*\/node_modules\/react-native\/.*/,
  /node_modules\/.*\.ts(x)?$/, // Ignore tous les TS/TSX externes
]);

// Ajouter les extensions utilisées
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Transformer standard + svg
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

module.exports = config;
