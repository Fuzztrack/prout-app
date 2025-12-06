import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Liste des sons disponibles (doivent être dans android/app/src/main/res/raw/)
const PROUT_SOUNDS = [
  'prout1', 'prout2', 'prout3', 'prout4', 'prout5',
  'prout6', 'prout7', 'prout8', 'prout9', 'prout10'
];

// �� PASSAGE EN V8 POUR FORCER LA MISE À JOUR NATIVE
const CHANNEL_SUFFIX = '-v8'; 

async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    console.log("🔊 Configuration des canaux audio Android (V8)...");

    for (const soundName of PROUT_SOUNDS) {
      const channelId = `${soundName}${CHANNEL_SUFFIX}`; // prout1-v8
      
      await Notifications.setNotificationChannelAsync(channelId, {
        name: `Son ${soundName}`,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        // ⚠️ IMPORTANT : Juste le nom de la ressource, sans extension .ogg
        sound: soundName, 
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
      });
    }
    
    // Canal par défaut
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Défaut',
      importance: Notifications.AndroidImportance.DEFAULT,
    });

    console.log("✅ Canaux V8 configurés !");
  } catch (error) {
    console.error('❌ Erreur config canaux:', error);
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
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
  } catch (err) {
    console.error("Erreur token:", err);
  }
  return token;
}
