// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// S'assurer que les fichiers audio sont traités comme des assets
// Ajouter explicitement .ogg, .wav, .mp3 aux extensions d'assets
const audioExtensions = ['ogg', 'wav', 'mp3'];
audioExtensions.forEach((ext) => {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
});

module.exports = config;

