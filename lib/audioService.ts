import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import i18n from './i18n';
import { SOUND_ASSETS, SOUND_KEYS_BY_CATEGORY } from './runtimeSounds';

const SOUND_CATEGORY_KEY = 'chat_message_sound_category_v1';
const SHOW_DEFAULT_SOUND_CATEGORY_CURSOR = false;

type PlaySoundOptions = {
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

let currentPlaybackSound: Audio.Sound | null = null;
let currentPlaybackToken = 0;
let currentPlaybackNotifyEnd: (() => void) | null = null;

export async function stopCurrentPlayback(shouldNotifyEnd = true) {
  const sound = currentPlaybackSound;
  const notifyEnd = currentPlaybackNotifyEnd;
  currentPlaybackSound = null;
  currentPlaybackNotifyEnd = null;
  currentPlaybackToken += 1;

  if (!sound) {
    if (shouldNotifyEnd) notifyEnd?.();
    return;
  }

  try {
    await sound.stopAsync();
  } catch (_) {}
  try {
    await sound.unloadAsync();
  } catch (_) {}
  if (shouldNotifyEnd) notifyEnd?.();
}

/**
 * Traduit une clé de son en libellé lisible (ex: "toot1" -> "Prout classique")
 */
export function getDisplaySoundLabel(soundKey: string): string {
  const tOrFallback = (key: string, fallback: string) => {
    const translated = i18n.t(key) as any;
    if (typeof translated !== 'string') return fallback;
    if (translated === key) return fallback;
    return translated;
  };

  const TRRL_FALLBACK: Record<string, string> = {
    trrl1: 'Le vertige du Shaman',
    trrl2: "L'Onde Incomprise",
    trrl3: 'Le Philosophe Noir',
    trrl4: 'Le Sifflet de Velours',
    trrl5: "L'Écho du Baobab",
  };

  if (soundKey.startsWith('prrt')) {
    const match = soundKey.match(/(\d+)/);
    const n = match?.[1] ? parseInt(match[1], 10) : NaN;
    if (Number.isFinite(n)) {
      return tOrFallback(`prout_names.prout${n}`, `prout${n}`);
    }
    return tOrFallback('prout_names.prout1', 'prout1');
  }
  
  if (soundKey.startsWith('bzzz')) {
    return tOrFallback(`prout_names.${soundKey}`, soundKey);
  }
  
  if (soundKey.startsWith('trrl')) {
    return tOrFallback(`prout_names.${soundKey}`, TRRL_FALLBACK[soundKey] ?? soundKey);
  }
  
  return tOrFallback(`prout_names.${soundKey}`, soundKey);
}

/**
 * Joue un son localement
 */
export async function playSound(
  soundKey: string,
  volumeOrOptions: number | PlaySoundOptions = 1.0
) {
  const soundFile = SOUND_ASSETS[soundKey] || SOUND_ASSETS['toot1'] || SOUND_ASSETS['bzzz1'];
  const options =
    typeof volumeOrOptions === 'number'
      ? { volume: volumeOrOptions }
      : volumeOrOptions;
  const volume = options.volume ?? 1.0;
  let hasEnded = false;

  const notifyEnd = () => {
    if (hasEnded) return;
    hasEnded = true;
    options.onEnd?.();
  };

  if (!soundFile) {
    notifyEnd();
    return;
  }

  try {
    await stopCurrentPlayback(true);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      soundFile,
      { shouldPlay: true, volume }
    );
    const playbackToken = ++currentPlaybackToken;
    currentPlaybackSound = sound;
    currentPlaybackNotifyEnd = notifyEnd;

    options.onStart?.();

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (playbackToken !== currentPlaybackToken) return;
      if (status.isLoaded && status.didJustFinish) {
        currentPlaybackSound = null;
        currentPlaybackNotifyEnd = null;
        await sound.unloadAsync();
        notifyEnd();
      }
    });
  } catch (error) {
    notifyEnd();
    if (__DEV__) console.warn('[AudioService] Failed to play sound', error);
  }
}

/**
 * Utilitaires pour le sélecteur de sons
 */
export const getPickupKeys = (category: string) => {
  return (SOUND_KEYS_BY_CATEGORY[category] || []).filter((key) => !!SOUND_ASSETS[key]);
};

export function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomWithoutImmediateRepeat(arr: string[], lastValue?: string) {
  if (!arr.length) return undefined;
  if (arr.length === 1) return arr[0];
  const filtered = lastValue ? arr.filter((item) => item !== lastValue) : arr;
  if (!filtered.length) return arr[0];
  return pickRandom(filtered);
}

/**
 * 1er démarrage / aucune préférence enregistrée : toot (proot).
 */
export function getDefaultSoundCategoryForFirstLaunch(): any {
  return 'toot';
}

export async function getSelectedSoundCategory(): Promise<any> {
  if (!SHOW_DEFAULT_SOUND_CATEGORY_CURSOR) {
    return 'toot';
  }
  try {
    const saved = await AsyncStorage.getItem(SOUND_CATEGORY_KEY);
    if (saved === 'bzzz' || saved === 'trll' || saved === 'pop' || saved === 'mood' || saved === 'toot') {
      return saved;
    }
  } catch (_) {}
  return getDefaultSoundCategoryForFirstLaunch();
}
