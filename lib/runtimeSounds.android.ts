const TRLL_KEYS = ['trrl1', 'trrl2', 'trrl3', 'trrl4', 'trrl5'];
const BZZZ_KEYS = ['bzzz1', 'bzzz2', 'bzzz3', 'bzzz4', 'bzzz5'];
const POP_KEYS = ['pop1', 'pop4', 'pop2', 'pop3', 'pop5'];
const MOOD_KEYS = ['mood1', 'mood2', 'mood3', 'mood4', 'mood5'];
/** Inclut les anciens prout4/11/12/14/16/19 renommés en toot*.wav pour le bundle Android */
const TOOT_KEYS = [
  'toot1',
  'toot3',
  'toot4',
  'toot6',
  'toot8',
  'toot9',
  'toot10',
  'toot11',
  'toot12',
  'toot13',
  'toot14',
  'toot16',
  'toot17',
  'toot18',
  'toot19',
  'toot20',
];

export const SOUND_KEYS_BY_CATEGORY: Record<string, string[]> = {
  trll: TRLL_KEYS,
  bzzz: BZZZ_KEYS,
  pop: POP_KEYS,
  mood: MOOD_KEYS,
  toot: TOOT_KEYS,
};

export const SOUND_ASSETS: Record<string, any> = {
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
  pop1: require('../assets/sounds/pop1.wav'),
  pop2: require('../assets/sounds/pop2.wav'),
  pop3: require('../assets/sounds/pop3.wav'),
  pop4: require('../assets/sounds/pop4.wav'),
  pop5: require('../assets/sounds/pop5.wav'),
  mood1: require('../assets/sounds/mood1.wav'),
  mood2: require('../assets/sounds/mood2.wav'),
  mood3: require('../assets/sounds/mood3.wav'),
  mood4: require('../assets/sounds/mood4.wav'),
  mood5: require('../assets/sounds/mood5.wav'),
  toot1: require('../assets/sounds/toot1.wav'),
  toot6: require('../assets/sounds/toot6.wav'),
  toot8: require('../assets/sounds/toot8.wav'),
  toot9: require('../assets/sounds/toot9.wav'),
  toot17: require('../assets/sounds/toot17.wav'),
  toot18: require('../assets/sounds/toot18.wav'),
  toot3: require('../assets/sounds/toot3.wav'),
  toot10: require('../assets/sounds/toot10.wav'),
  toot13: require('../assets/sounds/toot13.wav'),
  toot20: require('../assets/sounds/toot20.wav'),
  toot4: require('../assets/sounds/toot4.wav'),
  toot11: require('../assets/sounds/toot11.wav'),
  toot12: require('../assets/sounds/toot12.wav'),
  toot14: require('../assets/sounds/toot14.wav'),
  toot16: require('../assets/sounds/toot16.wav'),
  toot19: require('../assets/sounds/toot19.wav'),
};

export const PREVIEW_SOUNDS_BY_CATEGORY: Record<string, any[]> = {
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
  pop: [
    require('../assets/sounds/pop1.wav'),
    require('../assets/sounds/pop2.wav'),
    require('../assets/sounds/pop3.wav'),
    require('../assets/sounds/pop4.wav'),
    require('../assets/sounds/pop5.wav'),
  ],
  mood: [
    require('../assets/sounds/mood1.wav'),
    require('../assets/sounds/mood2.wav'),
    require('../assets/sounds/mood3.wav'),
    require('../assets/sounds/mood4.wav'),
    require('../assets/sounds/mood5.wav'),
  ],
  toot: [
    require('../assets/sounds/toot1.wav'),
    require('../assets/sounds/toot3.wav'),
    require('../assets/sounds/toot4.wav'),
    require('../assets/sounds/toot6.wav'),
    require('../assets/sounds/toot8.wav'),
    require('../assets/sounds/toot9.wav'),
    require('../assets/sounds/toot10.wav'),
    require('../assets/sounds/toot11.wav'),
    require('../assets/sounds/toot12.wav'),
    require('../assets/sounds/toot13.wav'),
    require('../assets/sounds/toot14.wav'),
    require('../assets/sounds/toot16.wav'),
    require('../assets/sounds/toot17.wav'),
    require('../assets/sounds/toot18.wav'),
    require('../assets/sounds/toot19.wav'),
    require('../assets/sounds/toot20.wav'),
  ],
};

export const DIRECT_SEND_FALLBACK_CATEGORY = 'trll';
export const LOCAL_PLAYBACK_FALLBACK_KEY = 'trrl1';
