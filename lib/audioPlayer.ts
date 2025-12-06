// lib/audioPlayer.ts
// Module pour gérer la lecture audio des notifications
import { useAudioPlayer, AudioSource } from 'expo-audio';

// Player global (sera initialisé depuis un composant React)
let globalPlayer: ReturnType<typeof useAudioPlayer> | null = null;
let proutSoundSource: AudioSource | null = null;

// Initialiser le player (à appeler depuis un composant React)
export function setGlobalPlayer(player: ReturnType<typeof useAudioPlayer>) {
  globalPlayer = player;
}

// Définir la source audio du son prout
export function setProutSoundSource(source: AudioSource) {
  proutSoundSource = source;
}

// Jouer le son prout localement (pour les notifications en foreground)
export async function playProutSoundLocally() {
  try {
    if (globalPlayer && proutSoundSource) {
      globalPlayer.replace(proutSoundSource);
      globalPlayer.play();
      console.log('🔊 Son prout joué localement');
    } else {
      console.warn('⚠️ Player ou source audio non initialisé');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du son prout:', error);
  }
}

