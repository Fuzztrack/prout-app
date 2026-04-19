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
    // MAIS on laisse passer si c'est un utilisateur déjà "en place" (a déjà un pseudo validé par ex)
    // pour le rattrapage sur les sessions suivantes.
    if (status === 'undetermined' && !isPastOnboarding) {
      if (__DEV__) console.log('🔔 [PushToken] Onboarding non terminé, on attend avant de demander la permission');
      return;
    }

    if (__DEV__) console.log(`🔔 [PushToken] Status: ${status}, PastOnboarding: ${isPastOnboarding}`);

    // Si permission déjà refusée, on ne peut plus rien faire automatiquement.
    if (status === 'denied') {
      if (__DEV__) console.log('🔔 [PushToken] Permission refusée par l\'utilisateur');
      
      // On log quand même dans la DB que la plateforme est identifiée mais sans token
      await supabase
        .from('user_profiles')
        .update({ push_platform: Platform.OS, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .eq('expo_push_token', null); // Seulement si pas déjà de token
      return;
    }

    // 3. Récupérer le token (getFCMToken gère lui-même la demande de permission si status est undetermined)
    const pushToken = await getFCMToken();
    if (!pushToken) {
      if (__DEV__) console.log('🔔 [PushToken] Impossible de récupérer le token (probablement refusé ou erreur SDK)');
      return;
    }

    if (__DEV__) console.log('🔔 [PushToken] Tentative d\'enregistrement pour', userId, 'Format:', pushToken.includes(':') ? 'FCM' : 'Expo');

    // 4. Nettoyer le token s'il est déjà utilisé par un autre compte
    try {
      await supabase
        .from('user_profiles')
        .update(EMPTY_PUSH_PAYLOAD)
        .eq('expo_push_token', pushToken)
        .neq('id', userId);
    } catch (cleanError) {
      if (__DEV__) console.log('🔔 [PushToken] Note: Nettoyage doublons ignoré');
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
    // On essaie d'abord un UPDATE
    const { error, count } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select('id');

    if (error) {
      console.error('❌ [PushToken] Erreur update profil:', error.message);
      throw error;
    }

    // Si aucune ligne n'a été modifiée (count === 0 ou select vide), on tente un UPSERT
    // car le trigger de création de profil a peut-être échoué ou n'est pas encore passé.
    if (!count || count === 0) {
      if (__DEV__) console.log('🔔 [PushToken] Aucune ligne trouvée avec update, tentative upsert...');
      
      // Récupérer le pseudo actuel pour ne pas l'écraser si on upsert
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('pseudo')
        .eq('id', userId)
        .maybeSingle();

      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          ...updatePayload,
          pseudo: existing?.pseudo || 'Nouveau Membre', // Fallback sécu
        });

      if (upsertError) {
        console.error('❌ [PushToken] Erreur upsert profil:', upsertError.message);
      } else {
        if (__DEV__) console.log('✅ [PushToken] Token enregistré via UPSERT');
      }
    } else {
      if (__DEV__) console.log('✅ [PushToken] Token mis à jour via UPDATE');
    }
  } catch (e: any) {
    console.error('❌ [PushToken] Exception critique:', e?.message || e);
  }
}
