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

// Met à jour les canaux Android pour activer/désactiver la vibration selon la préférence utilisateur
export async function updateAndroidNotificationChannelsVibration(enabled: boolean) {
  if (Platform.OS !== 'android') return;

  try {
    console.log(`🔧 [ANDROID] Mise à jour vibration des canaux: ${enabled ? 'activée' : 'désactivée'}`);
    
    // Récupérer tous les canaux existants
    const allChannels = await Notifications.getNotificationChannelsAsync();
    console.log(`📋 [ANDROID] Canaux existants trouvés: ${allChannels?.length || 0}`);
    
    let updatedCount = 0;
    
    // Mettre à jour aussi le canal par défaut si il existe
    const defaultChannelId = DEFAULT_CHANNEL_ID;
    const allChannelsForDefault = await Notifications.getNotificationChannelsAsync();
    const defaultChannel = allChannelsForDefault?.find(c => c.id === defaultChannelId);
    if (defaultChannel) {
      try {
        const defaultChannelConfig: any = {
          name: defaultChannel.name || 'Prout',
          importance: defaultChannel.importance || Notifications.AndroidImportance.MAX,
          sound: 'prout1',
          lockscreenVisibility: defaultChannel.lockscreenVisibility || Notifications.AndroidNotificationVisibility.PUBLIC,
          enableVibrate: enabled,
          bypassDnd: defaultChannel.bypassDnd !== false,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          }
        };
        if (enabled) {
          defaultChannelConfig.vibrationPattern = [0, 250, 250, 250];
        } else {
          // Pattern vide [0] = pas de vibration (plus fiable que enableVibrate: false)
          defaultChannelConfig.enableVibrate = true; // Doit être true pour que vibrationPattern soit pris en compte
          defaultChannelConfig.vibrationPattern = [0]; // Pattern vide = pas de vibration
        }
        await Notifications.deleteNotificationChannelAsync(defaultChannelId);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Notifications.setNotificationChannelAsync(defaultChannelId, defaultChannelConfig);
        console.log(`✅ [ANDROID] Canal par défaut ${defaultChannelId} recréé avec vibration ${enabled ? 'activée' : 'désactivée'}`);
      } catch (e) {
        console.error(`❌ [ANDROID] Erreur mise à jour canal par défaut:`, e);
      }
    }
    
    for (const soundName of PROUT_SOUNDS) {
      const channelId = getChannelIdForSound(soundName);
      
      try {
        // Récupérer le canal existant
        const existingChannel = allChannels?.find(c => c.id === channelId);
        
        if (existingChannel) {
          console.log(`🔧 [ANDROID] Mise à jour canal ${channelId}, vibration actuelle: ${existingChannel.enableVibrate}`);
          
          // Mettre à jour le canal avec la nouvelle configuration de vibration
          const channelConfig: any = {
            name: existingChannel.name || `Prout ${soundName}`,
            importance: existingChannel.importance || Notifications.AndroidImportance.MAX,
            sound: soundName,
            lockscreenVisibility: existingChannel.lockscreenVisibility || Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: existingChannel.bypassDnd !== false,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.NOTIFICATION,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            }
          };

          // Configurer la vibration selon la préférence
          // Note: Sur Android, enableVibrate: false peut ne pas fonctionner correctement
          // On utilise donc un pattern de vibration vide [0] pour désactiver la vibration
          if (enabled) {
            channelConfig.enableVibrate = true;
            channelConfig.vibrationPattern = [0, 250, 250, 250];
          } else {
            // Pattern vide [0] = pas de vibration (plus fiable que enableVibrate: false)
            channelConfig.enableVibrate = true; // Doit être true pour que vibrationPattern soit pris en compte
            channelConfig.vibrationPattern = [0]; // Pattern vide = pas de vibration
          }

          // Supprimer et recréer le canal avec la nouvelle config (Android ne permet pas de modifier directement)
          await Notifications.deleteNotificationChannelAsync(channelId);
          console.log(`🗑️ [ANDROID] Canal ${channelId} supprimé`);
          
          // Attendre un peu pour que la suppression soit propagée
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await Notifications.setNotificationChannelAsync(channelId, channelConfig);
          console.log(`✅ [ANDROID] Canal ${channelId} recréé avec vibration ${enabled ? 'activée' : 'désactivée'}`);
          
          // Vérifier que le canal a bien été créé avec la bonne configuration
          await new Promise(resolve => setTimeout(resolve, 200));
          const updatedChannels = await Notifications.getNotificationChannelsAsync();
          const updatedChannel = updatedChannels?.find(c => c.id === channelId);
          if (updatedChannel) {
            // Vérifier le pattern de vibration plutôt que enableVibrate (plus fiable)
            const hasVibrationPattern = updatedChannel.vibrationPattern && updatedChannel.vibrationPattern.length > 1;
            const expectedHasPattern = enabled;
            console.log(`✅ [ANDROID] Vérification canal ${channelId}: pattern=${JSON.stringify(updatedChannel.vibrationPattern)}, attendu=${enabled ? '[0,250,250,250]' : '[0]'}`);
            if (hasVibrationPattern !== expectedHasPattern) {
              console.warn(`⚠️ [ANDROID] Le canal ${channelId} n'a peut-être pas la bonne configuration de vibration (pattern: ${JSON.stringify(updatedChannel.vibrationPattern)})`);
            }
          }
          
          updatedCount++;
        } else {
          console.log(`⚠️ [ANDROID] Canal ${channelId} non trouvé, ignoré`);
        }
      } catch (channelError: any) {
        console.error(`❌ [ANDROID] Erreur mise à jour canal ${channelId}:`, channelError?.message || channelError);
      }
    }

    console.log(`✅ [ANDROID] ${updatedCount} canaux mis à jour avec vibration ${enabled ? 'activée' : 'désactivée'}`);
    
    // Attendre un peu pour que les changements soient propagés
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('❌ [ANDROID] Erreur mise à jour vibration canaux:', error);
  }
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
