import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PROUT_SOUNDS = [
  'prout1','prout2','prout3','prout4','prout5',
  'prout6','prout7','prout8','prout9','prout10',
  'prout11','prout12','prout13','prout14','prout15',
  'prout16','prout17','prout18','prout19','prout20'
];

// Canal par défaut pour Android (FCM)
export const DEFAULT_CHANNEL_ID = 'prout1';

export function getChannelIdForSound(soundName: string) {
  return `prout-${soundName}-v5`; // Harmonisation avec ProutMessagingService.kt (v5)
}

// Crée tous les canaux Android pour chaque son
async function configureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    console.log('🔧 [ANDROID] Début création des canaux de notification...');
    
    // Supprimer les anciens canaux avec suffixe
    const oldSuffixes = ['-v14','-v13','-v12','-v11','-v10','-v3','-v2']; // Ajout de -v3 et -v2 à supprimer
    for (const soundName of PROUT_SOUNDS) {
      // Supprimer aussi les versions brutes "prout1", etc.
      try { await Notifications.deleteNotificationChannelAsync(soundName); } catch {}
      
      for (const suffix of oldSuffixes) {
        try { 
          await Notifications.deleteNotificationChannelAsync(`prout-${soundName}${suffix}`); 
        } catch {}
      }
    }

    let createdCount = 0;
    for (const soundName of PROUT_SOUNDS) {
      const channelId = getChannelIdForSound(soundName); // ex: "prout1" (sans suffixe)
      // ⚡ Pour Android : Le nom de la ressource est SANS extension
      // Si le fichier est "prout1.wav" dans app.json, Android l'identifie comme "prout1"
      const soundResourceName = soundName; // "prout1" (sans extension)

      // Supprimer l'ancien canal s'il existe
      try { await Notifications.deleteNotificationChannelAsync(channelId); } catch {}

      try {
        const channelConfig = {
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
        };

        await Notifications.setNotificationChannelAsync(channelId, channelConfig);
        createdCount++;
      } catch (channelError: any) {
        console.error(`❌ [ANDROID] Erreur création canal ${channelId}:`, channelError?.message || channelError);
      }
    }

    console.log(`🎯 [ANDROID] ${createdCount}/${PROUT_SOUNDS.length} canaux créés avec succès`);

    // Attendre propagation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Vérifier que les canaux sont bien créés
    try {
      const allChannels = await Notifications.getNotificationChannelsAsync();
      const proutChannels = allChannels?.filter(c => c.id.startsWith('prout')) || [];
      console.log(`📋 [ANDROID] Canaux prout trouvés: ${proutChannels.length}`);
    } catch (checkError) {
      console.error('❌ [ANDROID] Erreur vérification canaux:', checkError);
    }

  } catch (error) {
    console.error('❌ [ANDROID] Erreur configuration canaux:', error);
  }
}

export async function ensureAndroidNotificationChannel() {
  // Sur Android, les canaux sont désormais créés nativement (MainApplication.onCreate).
  // On évite de les recréer côté JS pour réduire le temps de démarrage et les logs.
  if (Platform.OS === 'android') return;
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
