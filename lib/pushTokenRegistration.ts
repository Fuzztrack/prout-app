import AsyncStorage from '@react-native-async-storage/async-storage';
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
  if (Platform.OS === 'web' || !userId) return;

  try {
    // 1. Vérifier si l'utilisateur est passé par l'onboarding
    const onboardingSeen = await AsyncStorage.getItem('hasSeenOnboarding');
    const isPastOnboarding = onboardingSeen === 'true';

    // 2. Vérifier les permissions actuelles
    const { status } = await Notifications.getPermissionsAsync();
    
    // Si permission indéterminée ET qu'on n'est pas encore passé par l'onboarding,
    // on ne fait rien pour éviter de déclencher le popup système trop tôt.
    if (status === 'undetermined' && !isPastOnboarding) {
      if (__DEV__) console.log('🔔 [PushToken] Onboarding non terminé, on attend avant de demander la permission');
      return;
    }

    // Si permission déjà refusée, on ne peut plus rien faire automatiquement.
    // L'utilisateur devra aller dans les réglages.
    if (status === 'denied') {
      if (__DEV__) console.log('🔔 [PushToken] Permission refusée par l\'utilisateur');
      return;
    }

    // 3. Récupérer le token (getFCMToken gère lui-même la demande de permission si status est undetermined)
    const pushToken = await getFCMToken();
    if (!pushToken) {
      if (__DEV__) console.log('🔔 [PushToken] Impossible de récupérer le token (probablement refusé ou erreur)');
      return;
    }

    if (__DEV__) console.log('🔔 [PushToken] Tentative d\'enregistrement pour', userId);

    // 4. Nettoyer le token s'il est déjà utilisé par un autre compte (évite les doublons de notifs)
    // On ignore l'erreur car elle peut être due à des restrictions de RLS
    try {
      await supabase
        .from('user_profiles')
        .update(EMPTY_PUSH_PAYLOAD)
        .eq('expo_push_token', pushToken)
        .neq('id', userId);
    } catch (cleanError) {
      if (__DEV__) console.log('🔔 [PushToken] Note: Impossible de nettoyer les anciens tokens (normal si RLS activé)');
    }

    // 5. Préparer les données de mise à jour
    const updatePayload: Record<string, any> = {
      expo_push_token: pushToken,
      push_platform: Platform.OS,
      updated_at: new Date().toISOString()
    };

    if (Platform.OS === 'ios') {
      const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || Constants.easConfig?.projectId;
      if (bundleId) updatePayload.push_ios_bundle = bundleId;
    }

    // 6. Mettre à jour le profil de l'utilisateur actuel
    // On utilise UPDATE au lieu de UPSERT pour éviter de violer la contrainte NOT NULL sur le pseudo
    // si le profil est en cours de création par le trigger.
    const { error } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error) {
      console.error('❌ [PushToken] Erreur lors de la mise à jour du profil:', error.message);
    } else {
      if (__DEV__) console.log('✅ [PushToken] Token mis à jour avec succès');
    }
  } catch (e: any) {
    console.error('❌ [PushToken] Exception lors de l\'enregistrement:', e?.message || e);
  }
}
