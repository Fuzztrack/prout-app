import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getFCMToken } from './fcmToken';
import { supabase } from './supabase';

const EMPTY_PUSH_PAYLOAD = {
  expo_push_token: null,
  push_platform: null,
  push_ios_bundle: null,
};

export async function clearPushTokenForUser(userId: string) {
  const { error } = await supabase
    .from('user_profiles')
    .update(EMPTY_PUSH_PAYLOAD)
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function clearCurrentUserPushToken() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;
  await clearPushTokenForUser(user.id);
}

export async function registerPushTokenForUser(userId: string) {
  if (Platform.OS === 'web') return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    
    // Si permission indéterminée, on ne fait rien (on attend que l'utilisateur passe par l'onboarding)
    if (status !== 'granted') {
      if (__DEV__) console.log('🔔 [PushToken] Permission non accordée (status:', status, ')');
      return;
    }

    const pushToken = await getFCMToken();
    if (!pushToken) {
      if (__DEV__) console.log('🔔 [PushToken] Impossible de récupérer le token');
      return;
    }

    if (__DEV__) console.log('🔔 [PushToken] Tentative d\'enregistrement pour', userId);

    // 1. Nettoyer le token s'il est déjà utilisé par un autre compte (évite les doublons de notifs)
    // On ignore l'erreur car elle peut être due à des restrictions de RLS si on tente d'update un autre profil
    await supabase
      .from('user_profiles')
      .update(EMPTY_PUSH_PAYLOAD)
      .eq('expo_push_token', pushToken)
      .neq('id', userId);

    // 2. Préparer les données de mise à jour
    const updatePayload: Record<string, any> = {
      expo_push_token: pushToken,
      push_platform: Platform.OS,
      updated_at: new Date().toISOString()
    };

    if (Platform.OS === 'ios') {
      const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || Constants.easConfig?.projectId;
      if (bundleId) updatePayload.push_ios_bundle = bundleId;
    }

    // 3. Mettre à jour le profil de l'utilisateur actuel
    const { error } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error) {
      console.error('❌ [PushToken] Erreur lors de la mise à jour du profil:', error.message);
      // Optionnel : essayer un upsert si l'update échoue (si le profil n'existe pas encore par exemple)
    } else {
      if (__DEV__) console.log('✅ [PushToken] Token enregistré avec succès');
    }
  } catch (e: any) {
    console.error('❌ [PushToken] Exception lors de l\'enregistrement:', e?.message || e);
  }
}
