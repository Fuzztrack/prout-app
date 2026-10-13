import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { playSound } from './audioService';
import { triggerProutHaptic } from './proutHaptics';
import { useChatStore } from './chatStore';
import type { Friend } from '../hooks/useFriends';
import i18n from './i18n';

export const PROOT_BOT_ID = 'proot-bot';
export const PROOT_BOT_DISMISSED_KEY = 'proot_bot_dismissed_v1';

export const PROOT_BOT_FRIEND: Friend = {
  id: PROOT_BOT_ID,
  pseudo: 'ProotBot 🤖',
  avatar_url: null,
  last_interaction_at: new Date().toISOString(),
  is_muted: false,
  isZenMode: false,
  flame_streak: 1,
};

const BOT_SOUNDS = [
  'toot1', 'toot3', 'toot4', 'toot6', 'toot8',
  'prrt1', 'prrt6', 'prrt8', 'bzzz1', 'pop1'
];

const BOT_REPLIES_BY_LOCALE: Record<string, string[]> = {
  fr: [
    "💨 Prrrrt ! Bien joué champion !",
    "💨 Oulala… En voilà un bon !",
    "💨 Même pas mal ! Tiens, prends ça !",
    "💨 Le Kraken s'est réveillé !",
    "💨 Écoute ce chef-d'œuvre !",
    "💨 Splendide ! À toi de jouer !",
  ],
  en: [
    "💨 Prrrrt! Nice shot champ!",
    "💨 Whoa… That was a good one!",
    "💨 Didn't even hurt! Take this!",
    "💨 The Kraken has awakened!",
    "💨 Listen to this masterpiece!",
    "💨 Splendid! Your turn now!",
  ],
  es: [
    "💨 ¡Prrrrt! ¡Bien jugado campeón!",
    "💨 ¡Huyyy… este sí que fue bueno!",
    "💨 ¡Ni me dolió! ¡Toma esto!",
    "💨 ¡El Kraken se ha despertado!",
    "💨 ¡Escucha esta obra maestra!",
    "💨 ¡Espléndido! ¡Te toca!",
  ],
  pt: [
    "💨 Prrrrt! Bem jogado campeão!",
    "💨 Uau… esse foi potente!",
    "💨 Nem doeu! Toma lá isto!",
    "💨 O Kraken acordou!",
    "💨 Ouve só esta obra-prima!",
    "💨 Esplêndido! Agora é a tua vez!",
  ],
  de: [
    "💨 Prrrrt! Gut gemacht, Champion!",
    "💨 Oho… Das war ein guter!",
    "💨 Hat gar nicht wehgetan! Nimm das!",
    "💨 Der Krake ist erwacht!",
    "💨 Hör dir dieses Meisterwerk an!",
    "💨 Großartig! Jetzt bist du dran!",
  ],
  it: [
    "💨 Prrrrt! Ben fatto campione!",
    "💨 Mamma mia… questo sì che era buono!",
    "💨 Neanche male! Prendi questo!",
    "💨 Il Kraken si è svegliato!",
    "💨 Ascolta questo capolavoro!",
    "💨 Splendido! Tocca a te!",
  ],
};

function getBotReplies(): string[] {
  const lang = (i18n.locale || 'fr').toLowerCase().split(/[-_]/)[0];
  return BOT_REPLIES_BY_LOCALE[lang] || BOT_REPLIES_BY_LOCALE.en || BOT_REPLIES_BY_LOCALE.fr;
}

export function isProotBot(id?: string | null): boolean {
  return id === PROOT_BOT_ID;
}

export async function isProotBotDismissed(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PROOT_BOT_DISMISSED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setProotBotDismissed(dismissed = true): Promise<void> {
  try {
    if (dismissed) {
      await AsyncStorage.setItem(PROOT_BOT_DISMISSED_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(PROOT_BOT_DISMISSED_KEY);
    }
  } catch {}
}

export const PROOT_BOT_GESTURE_HINT_SEEN_KEY = '@proot_bot_gesture_hint_seen_v1';

let cachedGestureHintSeen: boolean | null = null;

// Pré-chargement asynchrone dès l'importation du module
AsyncStorage.getItem(PROOT_BOT_GESTURE_HINT_SEEN_KEY)
  .then((val) => {
    cachedGestureHintSeen = val === '1' || val === 'true';
  })
  .catch(() => {});

export async function isProotBotGestureHintSeen(): Promise<boolean> {
  if (cachedGestureHintSeen !== null) {
    return cachedGestureHintSeen;
  }
  try {
    const val = await AsyncStorage.getItem(PROOT_BOT_GESTURE_HINT_SEEN_KEY);
    cachedGestureHintSeen = val === '1' || val === 'true';
    return cachedGestureHintSeen;
  } catch {
    return false;
  }
}

export function isProotBotGestureHintSeenSync(): boolean {
  return cachedGestureHintSeen === true;
}

export async function setProotBotGestureHintSeen(): Promise<void> {
  cachedGestureHintSeen = true;
  try {
    await AsyncStorage.setItem(PROOT_BOT_GESTURE_HINT_SEEN_KEY, '1');
  } catch {}
}

export async function triggerProotBotResponse(
  isHapticEnabled = true,
  onReply?: (proutKey: string, replyText: string) => void
): Promise<void> {
  const randomSound = BOT_SOUNDS[Math.floor(Math.random() * BOT_SOUNDS.length)];
  const replies = getBotReplies();
  const randomReply = replies[Math.floor(Math.random() * replies.length)];

  // 1. Notification locale programmée à 3 secondes
  // (permet d'afficher la notification même si l'utilisateur quitte l'application)
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('prootbot_replied'),
        body: randomReply,
        data: { type: 'prout', key: randomSound, senderId: PROOT_BOT_ID },
        sound: 'default',
      },
      trigger: { seconds: 3 } as any,
    });
  } catch (e) {
    console.warn('⚠️ Erreur programmation notification ProotBot:', e);
  }

  // 2. Timer in-app de 3 secondes pour l'expérience foreground (son + haptique + chat)
  setTimeout(() => {
    try {
      // Audio
      playSound(randomSound);

      // Haptique
      triggerProutHaptic(randomSound, isHapticEnabled);

      // Injection dans le chat store local
      const msgId = `bot-${Date.now()}`;
      useChatStore.getState().addReceivedMessages(PROOT_BOT_ID, [{
        id: msgId,
        from_user_id: PROOT_BOT_ID,
        message_content: `[${randomSound}]${randomReply}`,
        created_at: new Date().toISOString(),
        local_ts: Date.now(),
      }]);

      onReply?.(randomSound, randomReply);
    } catch (err) {
      console.warn('⚠️ Erreur exécution réponse ProotBot:', err);
    }
  }, 3000);
}
