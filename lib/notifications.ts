import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PROUT_SOUNDS = [
  'prout1','prout2','prout3','prout4','prout5',
  'prout6','prout7','prout8','prout9','prout10',
  'prout11','prout12','prout13','prout14','prout15',
  'prout16','prout17','prout18','prout19','prout20'
];

const CHANNEL_SUFFIX = '-v14';

// Canal par défaut pour Android (FCM)
export const DEFAULT_CHANNEL_ID = `prout1${CHANNEL_SUFFIX}`;

export function getChannelIdForSound(soundName: string) {
  return `${soundName}${CHANNEL_SUFFIX}`;
}

// Crée tous les canaux Android pour chaque son
async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    const oldSuffixes = ['-v13','-v12','-v11','-v10'];
    for (const soundName of PROUT_SOUNDS) {
      for (const suffix of oldSuffixes) {
        try { 
          await Notifications.deleteNotificationChannelAsync(`${soundName}${suffix}`); 
        } catch {}
      }
    }

    for (const soundName of PROUT_SOUNDS) {
      const channelId = getChannelIdForSound(soundName);
      const soundResourceName = soundName; // ⚡ PAS D'EXTENSION

      try { await Notifications.deleteNotificationChannelAsync(channelId); } catch {}

      await Notifications.setNotificationChannelAsync(channelId, {
        name: `Prout ${soundName}`,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: soundResourceName,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        bypassDnd: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        }
      });
    }

    // Attendre propagation
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('Erreur configuration canaux:', error);
  }
}

export async function ensureAndroidNotificationChannel() {
  await configureAndroidNotificationChannels();
}

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  if (!Constants.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    await ensureAndroidNotificationChannel();

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        token = tokenData.data;
    } catch (e) { console.log("Erreur Token:", e); }
  } catch (err) { console.error(err); }

  return token;
}
