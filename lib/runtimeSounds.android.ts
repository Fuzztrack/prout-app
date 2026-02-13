const PRRT_KEYS = ['prrt1', 'prrt6', 'prrt8', 'prrt9', 'prrt17', 'prrt18'];
const TRLL_KEYS = ['trrl1', 'trrl2', 'trrl3', 'trrl4', 'trrl5'];
const BZZZ_KEYS = ['bzzz1', 'bzzz2', 'bzzz3', 'bzzz4', 'bzzz5'];

export const SOUND_KEYS_BY_CATEGORY: Record<string, string[]> = {
  prrt: PRRT_KEYS,
  trll: TRLL_KEYS,
  bzzz: BZZZ_KEYS,
};

export const SOUND_ASSETS: Record<string, any> = {
  prrt1: require('../assets/sounds/prrt1.wav'),
  prrt6: require('../assets/sounds/prrt6.wav'),
  prrt8: require('../assets/sounds/prrt8.wav'),
  prrt9: require('../assets/sounds/prrt9.wav'),
  prrt17: require('../assets/sounds/prrt17.wav'),
  prrt18: require('../assets/sounds/prrt18.wav'),
  bzzz1: require('../assets/sounds/bzzz1.wav'),
  bzzz2: require('../assets/sounds/bzzz2.wav'),
  bzzz3: require('../assets/sounds/bzzz3.wav'),
  bzzz4: require('../assets/sounds/bzzz4.wav'),
  bzzz5: require('../assets/sounds/bzzz5.wav'),
  trrl1: require('../assets/sounds/trrl1.wav'),
  trrl2: require('../assets/sounds/trrl2.wav'),
  trrl3: require('../assets/sounds/trrl3.wav'),
  trrl4: require('../assets/sounds/trrl4.wav'),
  trrl5: require('../assets/sounds/trrl5.wav'),
};

export const PREVIEW_SOUNDS_BY_CATEGORY: Record<string, any[]> = {
  prrt: [
    require('../assets/sounds/prrt1.wav'),
    require('../assets/sounds/prrt6.wav'),
    require('../assets/sounds/prrt8.wav'),
    require('../assets/sounds/prrt9.wav'),
    require('../assets/sounds/prrt17.wav'),
    require('../assets/sounds/prrt18.wav'),
  ],
  trll: [
    require('../assets/sounds/trrl1.wav'),
    require('../assets/sounds/trrl2.wav'),
    require('../assets/sounds/trrl3.wav'),
    require('../assets/sounds/trrl4.wav'),
    require('../assets/sounds/trrl5.wav'),
  ],
  bzzz: [
    require('../assets/sounds/bzzz1.wav'),
    require('../assets/sounds/bzzz2.wav'),
    require('../assets/sounds/bzzz3.wav'),
    require('../assets/sounds/bzzz4.wav'),
    require('../assets/sounds/bzzz5.wav'),
  ],
};

export const DIRECT_SEND_FALLBACK_CATEGORY = 'prrt';
export const LOCAL_PLAYBACK_FALLBACK_KEY = 'prrt1';
