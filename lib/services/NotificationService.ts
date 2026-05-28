import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import i18n from '@/lib/i18n';
import { safePush, safeReplace } from '@/lib/navigation';
import { useChatStore } from '@/lib/chatStore';

const ACTIVE_CHAT_FRIEND_ID_KEY = 'active_chat_friend_id_v1';

/**
 * Extrait et injecte les données d'un message dans le store Zustand.
 * Utilisé pour avoir une synchro instantanée sans attendre le réseau.
 */
export const injectMessageFromNotification = async (data: any) => {
  const tStart = Date.now();
  // console.log(`⏱️ [PERF] ${tStart} - DÉBUT injectMessageFromNotification`);

  let messageDataRaw = data?.m_d || data?.messageData;
  
  // Support du format à plat (fallback)
  if (!messageDataRaw && data?.senderId) {
    messageDataRaw = {
      id: data.id || `notif-${data.senderId}-${Date.now()}`,
      from_user_id: data.senderId,
      to_user_id: data.receiverId,
      message_content: data.message_content || (data.customMessage ? `${data.proutKey ? `[${data.proutKey}]` : ''}${data.customMessage}` : null),
      created_at: data.created_at || new Date().toISOString(),
    };
  }

  if (!messageDataRaw) {
    // console.log(`⏱️ [PERF] ${Date.now()} - FIN injectMessageFromNotification (Pas de données) (+${Date.now() - tStart}ms)`);
    return;
  }

  try {
    // Sécurité : Attendre que le store soit hydraté pour ne pas perdre l'injection
    // (notamment au démarrage depuis un killed state)
    let retry = 0;
    while (!useChatStore.getState().hasHydrated && retry < 30) {
      // if (retry === 0) console.log(`⏱️ [PERF] ${Date.now()} - injectMessageFromNotification : Attente hydratation Zustand...`);
      await new Promise(r => setTimeout(r, 100));
      retry++;
    }
    
    // console.log(`⏱️ [PERF] ${Date.now()} - injectMessageFromNotification : Zustand est hydraté (+${Date.now() - tStart}ms)`);

    const msg = typeof messageDataRaw === 'string' ? JSON.parse(messageDataRaw) : messageDataRaw;
    const senderId = data.senderId || msg.from_user_id || msg.senderId;

    if (senderId && msg.id && msg.message_content) {
      // console.log(`🚀 [NotificationService] Injection directe message ${msg.id} pour ${senderId}`);
      
      useChatStore.getState().addReceivedMessages(senderId, [{
        id: msg.id,
        from_user_id: msg.from_user_id || senderId,
        to_user_id: msg.to_user_id,
        message_content: msg.message_content,
        created_at: msg.created_at || new Date().toISOString(),
        local_ts: Date.now(),
      }]);
      // console.log(`⏱️ [PERF] ${Date.now()} - FIN injectMessageFromNotification : Message injecté (+${Date.now() - tStart}ms)`);
    }
  } catch (e) {
    console.error('❌ [NotificationService] Erreur injection messageData:', e);
  }
};

export const initNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const senderId =
        typeof notification.request.content.data?.senderId === 'string'
          ? notification.request.content.data.senderId
          : null;
      const activeChatFriendId = await AsyncStorage.getItem(ACTIVE_CHAT_FRIEND_ID_KEY);
      const suppressSystemNotification =
        AppState.currentState === 'active' &&
        !!senderId &&
        activeChatFriendId === senderId;

      return {
        shouldPlaySound: !suppressSystemNotification,
        shouldSetBadge: false,
        shouldShowBanner: !suppressSystemNotification,
        shouldShowList: !suppressSystemNotification,
      };
    },
  });
};

export const setupNotificationListeners = (
  router: any,
  showToast: (title: string, body: string) => void
) => {
  const notificationListener = Notifications.addNotificationReceivedListener(async (notification) => {
    const { title, body, data } = notification.request.content;
    
    // LOGS FORCÉS POUR DEBUG SYNCHRO
    console.log('🔔 [NotificationService] Notification reçue !');
    console.log('📦 Data (full):', JSON.stringify(data, null, 2));

    // Injection immédiate dans le store
    await injectMessageFromNotification(data);

    // Émettre un événement global avec les données pour jouer le son et rafraîchir
    if (data && Object.keys(data).length > 0) {
      DeviceEventEmitter.emit('REFRESH_DATA', data);
    }

    // Retour haptique iOS
    if (Platform.OS === 'ios') {
      try {
        const hapticEnabled = await AsyncStorage.getItem('haptic_feedback_enabled');
        const shouldTriggerHaptic = hapticEnabled === null || hapticEnabled === 'true';
        
        if (shouldTriggerHaptic) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }, 100);
        }
      } catch (e) {
        console.error('❌ [HAPTIC] Erreur:', e);
      }
      return;
    }
    
    // Toast Android
    if (data?.type === 'prout') {
      showToast(title || 'Prout !', body || '');
    } else if (data?.type === 'identity_response') {
      showToast(i18n.t('identity_revealed_title'), body || i18n.t('identity_revealed_body'));
    }
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
    const data: any = response.notification.request.content.data;
    
    // Injection immédiate (au cas où on vient du "killed state")
    await injectMessageFromNotification(data);

    // Délai pour s'assurer que l'app est prête
    setTimeout(() => {
      if (data?.type === 'identity_request') {
        safePush(router, {
          pathname: '/IdentityRevealScreen',
          params: {
            requesterId: data.requesterId,
            requesterPseudo: data.requesterPseudo,
          }
        }, { skipInitialCheck: false });
      } else if (data?.type === 'identity_response' || data?.type === 'prout') {
        safeReplace(router, '/(tabs)', { skipInitialCheck: false });
      }
    }, 500);
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
};
