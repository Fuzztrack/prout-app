import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import i18n from '@/lib/i18n';
import { safePush, safeReplace } from '@/lib/navigation';

const ACTIVE_CHAT_FRIEND_ID_KEY = 'active_chat_friend_id_v1';

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
    if (__DEV__) console.log('🔔 [NotificationService] Notification reçue:', JSON.stringify(data));

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

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    const data: any = response.notification.request.content.data;
    
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
