import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Déclic haptique instantané lorsque le swipe franchit le seuil d'envoi (cran d'armement)
 */
export async function triggerProutThresholdHaptic(isHapticEnabled: boolean = true) {
  if (!isHapticEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    try {
      Vibration.vibrate(40);
    } catch {}
  }
}

/**
 * Joue une vibration au rythme exact du son envoyé lors du swipe
 */
export async function triggerProutHaptic(soundKey: string, isHapticEnabled: boolean = true) {
  if (!isHapticEnabled) return;

  const key = (soundKey || '').toLowerCase();
  if (__DEV__) {
    console.log('📳 [HAPTIC] Triggering for soundKey:', key, 'isHapticEnabled:', isHapticEnabled, 'Platform:', Platform.OS);
  }

  try {
    if (Platform.OS === 'android') {
      // Cas ultra-spécial : L'Éternel (toot20 / prout20) -> Gros et long grondement titanesque
      if (key === 'toot20' || key === 'prout20') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        Vibration.vibrate([
          0, 400, 70, 500, 70, 600, 80, 700, 80, 800, 90, 900, 100, 1100, 100, 1200
        ]);
        return;
      }

      // Impulsion initiale nette via Haptics pour les téléphones équipés d'un moteur haptique (comme Pixel)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

      if (key.startsWith('bzzz')) {
        // Vibrations électriques rapides en rafale
        Vibration.vibrate([0, 35, 30, 40, 30, 50, 30, 70]);
      } else if (key.startsWith('pop')) {
        // Double-pop sec et joyeux
        Vibration.vibrate([0, 35, 65, 50]);
      } else if (key.startsWith('trrl')) {
        // Roulement en crescendo
        Vibration.vibrate([0, 30, 40, 40, 40, 60, 40, 80, 40, 50]);
      } else if (key.startsWith('mood')) {
        // Pulsation ondulante plus lente
        Vibration.vibrate([0, 120, 80, 160, 70, 140]);
      } else if (
        key === 'toot11' || key === 'toot12' || key === 'toot19' ||
        key === 'prout11' || key === 'prout12' || key === 'prout19'
      ) {
        // Mitraille molle / rafale infernale (staccato rapide)
        Vibration.vibrate([0, 50, 35, 50, 35, 60, 35, 70, 35, 90]);
      } else if (
        key === 'toot3' || key === 'toot16' ||
        key === 'prout3' || key === 'prout16'
      ) {
        // Tonnerre (gros impact lourd)
        Vibration.vibrate([0, 180, 60, 220, 60, 280, 70, 200]);
      } else {
        // Prout classique : impact franc suivi de résonance
        Vibration.vibrate([0, 130, 60, 110]);
      }
    } else {
      // Sur iOS : Séquence ultra-précise avec le Taptic Engine d'Apple

      // Cas ultra-spécial : L'Éternel (toot20 / prout20) -> Gros et long retour haptique continu
      if (key === 'toot20' || key === 'prout20') {
        for (let i = 0; i < 36; i++) {
          const style = (i % 3 === 0)
            ? Haptics.ImpactFeedbackStyle.Heavy
            : (i % 3 === 1)
              ? Haptics.ImpactFeedbackStyle.Rigid
              : Haptics.ImpactFeedbackStyle.Heavy;
          await Haptics.impactAsync(style);
          const delay = i < 8 ? 95 : i < 24 ? 75 : 85;
          await sleep(delay);
        }
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return;
      }

      if (key.startsWith('bzzz')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(40);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(40);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(40);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      } else if (key.startsWith('pop')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(70);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (key.startsWith('trrl')) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(50);
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
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        await sleep(45);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (
        key === 'toot3' || key === 'toot16' ||
        key === 'prout3' || key === 'prout16'
      ) {
        // Tonnerre : gros impact
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(70);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(80);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        await sleep(90);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        // Classique
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await sleep(70);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  } catch {
    // Ne jamais bloquer l'envoi en cas d'erreur de vibration
  }
}

