import { getChannelIdForSound } from './notifications';
import { supabase } from './supabase';
import { sendProutViaBackend } from './sendProutBackend';
import i18n from './i18n';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendProutPush(
  recipientExpoPushToken: string,
  senderPseudo: string,
  soundKey: string
) {
  const channelId = getChannelIdForSound(soundKey);

  const message = {
    to: recipientExpoPushToken,
    title: `${senderPseudo} t'envoie un prout`,
    body: 'Un nouveau prout !',
    sound: 'default', // iOS
    android: { channelId }, // ⚡ canal dynamique selon le son
    data: { type: 'prout', key: soundKey }
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    const resJson = await response.json();
    return resJson.data?.[0]?.status || 'sent';
  } catch (err) {
    console.error("Erreur envoi push:", err);
    throw err;
  }
}

export async function sendFriendRequestNotification(
  targetUserId: string,
  senderPseudo: string
) {
  try {
    const { data: targetProfile, error } = await supabase
      .from('user_profiles')
      .select('expo_push_token, push_platform')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error || !targetProfile?.expo_push_token) {
      return false;
    }

    const token = targetProfile.expo_push_token;
    const title = i18n.t('friend_request_push_title');
    const body = i18n.t('friend_request_push_body', { pseudo: senderPseudo });

    // 1. Si token Expo (iOS ou simulateur/client Expo)
    if (token.startsWith('ExponentPushToken')) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title,
          body,
          sound: 'default',
          data: { type: 'friend_request' },
        }),
      });
      return true;
    }

    // 2. Si token FCM natif (Android), router via le backend NestJS / prout-proxy
    await sendProutViaBackend(
      token,
      senderPseudo,
      'toot1',
      (targetProfile.push_platform as 'ios' | 'android' | undefined) || 'android',
      {
        customTitle: title,
        customMessage: body,
      }
    );
    return true;
  } catch (e) {
    console.warn('⚠️ Impossible d’envoyer la notification de demande d’ami:', e);
    return false;
  }
}
