import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Joue une vibration au rythme exact du son envoyé lors du swipe
 */
export async function triggerProutHaptic(soundKey: string, isHapticEnabled: boolean = true) {
  if (!isHapticEnabled) return;

  const key = (soundKey || '').toLowerCase();

  try {
    if (Platform.OS === 'android') {
      // Sur Android : Vibration par motif (tableau [pause, vibration, pause, vibration...])
      if (key.startsWith('bzzz')) {
        // Vibrations électriques rapides en rafale
        Vibration.vibrate([0, 35, 45, 35, 45, 70]);
      } else if (key.startsWith('pop')) {
        // Double-pop sec et joyeux
        Vibration.vibrate([0, 30, 80, 60]);
      } else if (key.startsWith('trrl')) {
        // Roulement en crescendo
        Vibration.vibrate([0, 25, 40, 35, 45, 75, 40, 30]);
      } else if (key.startsWith('mood')) {
        // Pulsation ondulante plus lente
        Vibration.vibrate([0, 90, 70, 110]);
      } else if (
        key === 'toot11' || key === 'toot12' || key === 'toot19' ||
        key === 'prout11' || key === 'prout12' || key === 'prout19'
      ) {
        // Mitraille molle / rafale infernale (staccato rapide)
        Vibration.vibrate([0, 50, 40, 50, 40, 60, 40, 80]);
      } else if (
        key === 'toot3' || key === 'toot16' || key === 'toot20' ||
        key === 'prout3' || key === 'prout16' || key === 'prout20'
      ) {
        // Tonnerre / l'Éternel (gros impact lourd)
        Vibration.vibrate([0, 110, 60, 100, 50, 80]);
      } else {
        // Prout classique : impact franc suivi de résonance
        Vibration.vibrate([0, 70, 50, 60]);
      }
    } else {
      // Sur iOS : Séquence ultra-précise avec le Taptic Engine d'Apple
      if (key.startsWith('bzzz')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(50);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(50);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(50);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (key.startsWith('pop')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(80);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (key.startsWith('trrl')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(50);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(50);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(60);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (key.startsWith('mood')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(100);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(80);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (
        key === 'toot11' || key === 'toot12' || key === 'toot19' ||
        key === 'prout11' || key === 'prout12' || key === 'prout19'
      ) {
        // Mitraille
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(55);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(55);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(55);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (
        key === 'toot3' || key === 'toot16' || key === 'toot20' ||
        key === 'prout3' || key === 'prout16' || key === 'prout20'
      ) {
        // Gros impact
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(80);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(70);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        // Classique
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(60);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  } catch (e) {
    // Ne jamais bloquer l'envoi en cas d'erreur de vibration
  }
}
