// Fonction pour obtenir le token de notification
// Sur iOS ET Android : Expo Push Token (via expo-notifications)
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function getFCMToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  // Utiliser Expo Push Token pour iOS ET Android
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      finalStatus = newStatus;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permission de notifications refusée');
      return null;
    }
    
    if (Platform.OS === 'android') {
      // Sur Android on récupère le token FCM natif (pour Firebase directement)
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      const token = (deviceToken as any)?.data ?? (deviceToken as any)?.token ?? null;
      return token;
    }

    // iOS : on continue d'utiliser le token Expo (géré par APNs via Expo)
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du token Expo Push:', error);
    return null;
  }
}

