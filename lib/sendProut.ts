import { getChannelIdForSound } from './notifications';

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
