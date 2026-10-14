import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { useEffect, useState } from 'react';
import { useFriendsStore } from './friendsStore';

const KEY_APP_OPEN_COUNT = 'user_exp_app_open_count';
const KEY_HAS_SWIPED = 'user_exp_has_swiped';
const KEY_HAS_SENT_MESSAGE = 'user_exp_has_sent_message';
const KEY_HAS_SELECTED_SOUND = 'user_exp_has_selected_sound';
const KEY_FOOTER_HELP_DISMISSED = 'user_exp_footer_help_dismissed';
const KEY_FRIEND_SOUND_MAP = 'friend_sound_map';

export const USER_EXP_EVENT = 'USER_EXP_UPDATED';

/**
 * Enregistre une ouverture de l'application
 */
export async function recordAppOpen(): Promise<number> {
  try {
    const rawCount = await AsyncStorage.getItem(KEY_APP_OPEN_COUNT);
    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
    
    let currentCount = 0;
    if (rawCount === null) {
      // Si c'est un utilisateur établi qui a déjà vu l'onboarding et a des interactions
      const friends = useFriendsStore.getState().friends || [];
      const hasInteractions = friends.some((f: any) => f.last_interaction_at || (f.flame_streak && f.flame_streak > 0));
      currentCount = (hasSeenOnboarding === 'true' && hasInteractions) ? 10 : 1;
    } else {
      currentCount = parseInt(rawCount, 10) || 0;
      currentCount += 1;
    }

    await AsyncStorage.setItem(KEY_APP_OPEN_COUNT, String(currentCount));
    DeviceEventEmitter.emit(USER_EXP_EVENT);
    return currentCount;
  } catch (e) {
    return 1;
  }
}

/**
 * Enregistre qu'un swipe (envoi de prout) a été effectué
 */
export async function recordSwipeAction(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_HAS_SWIPED, 'true');
    DeviceEventEmitter.emit(USER_EXP_EVENT);
  } catch {}
}

/**
 * Enregistre qu'un message de chat a été envoyé
 */
export async function recordMessageAction(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_HAS_SENT_MESSAGE, 'true');
    DeviceEventEmitter.emit(USER_EXP_EVENT);
  } catch {}
}

/**
 * Enregistre qu'un son a été sélectionné pour un ami ou un message
 */
export async function recordSoundSelectAction(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_HAS_SELECTED_SOUND, 'true');
    DeviceEventEmitter.emit(USER_EXP_EVENT);
  } catch {}
}

/**
 * Vérifie si les phrases explicatives (tips du footer) doivent être affichées
 * Condition de masquage : >= 10 ouvertures ET (swipe effectué) ET (message envoyé) ET (sélection de son effectuée)
 */
export async function checkShouldShowFooterHelp(): Promise<boolean> {
  try {
    // 1. Déjà masqué définitivement ?
    const dismissed = await AsyncStorage.getItem(KEY_FOOTER_HELP_DISMISSED);
    if (dismissed === 'true') {
      return false;
    }

    // 2. Nombre d'ouvertures de l'app (au bout d'une dizaine d'ouvertures)
    const openCountRaw = await AsyncStorage.getItem(KEY_APP_OPEN_COUNT);
    const openCount = openCountRaw ? parseInt(openCountRaw, 10) : 0;
    if (openCount < 10) {
      return true; // Moins de 10 ouvertures -> afficher les explications
    }

    // 3. Swipe effectué ?
    let hasSwiped = (await AsyncStorage.getItem(KEY_HAS_SWIPED)) === 'true';
    if (!hasSwiped) {
      const friends = useFriendsStore.getState().friends || [];
      if (friends.some((f: any) => f.last_interaction_at || (f.flame_streak && f.flame_streak > 0))) {
        hasSwiped = true;
        await AsyncStorage.setItem(KEY_HAS_SWIPED, 'true');
      }
    }
    if (!hasSwiped) return true;

    // 4. Message envoyé ?
    const hasSentMessage = (await AsyncStorage.getItem(KEY_HAS_SENT_MESSAGE)) === 'true';
    if (!hasSentMessage) return true;

    // 5. Sélection de son effectuée ?
    let hasSelectedSound = (await AsyncStorage.getItem(KEY_HAS_SELECTED_SOUND)) === 'true';
    if (!hasSelectedSound) {
      const soundMapRaw = await AsyncStorage.getItem(KEY_FRIEND_SOUND_MAP);
      if (soundMapRaw) {
        try {
          const map = JSON.parse(soundMapRaw);
          if (map && Object.keys(map).length > 0) {
            hasSelectedSound = true;
            await AsyncStorage.setItem(KEY_HAS_SELECTED_SOUND, 'true');
          }
        } catch {}
      }
    }
    if (!hasSelectedSound) return true;

    // Toutes les conditions sont remplies (>= 10 ouvertures, swipe fait, message fait, sélection de son faite)
    await AsyncStorage.setItem(KEY_FOOTER_HELP_DISMISSED, 'true');
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Hook React pour observer dynamiquement la visibilité des explications de bas de liste
 */
export function useFooterHelpVisibility(): boolean {
  const [shouldShow, setShouldShow] = useState<boolean>(true);

  useEffect(() => {
    checkShouldShowFooterHelp().then(setShouldShow).catch(() => setShouldShow(true));

    const sub = DeviceEventEmitter.addListener(USER_EXP_EVENT, () => {
      checkShouldShowFooterHelp().then(setShouldShow).catch(() => {});
    });

    return () => {
      sub.remove();
    };
  }, []);

  return shouldShow;
}
