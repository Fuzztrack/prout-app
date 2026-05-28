import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Alert, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { safeReplace } from '@/lib/navigation';
import { logSessionSnapshot } from '@/lib/authDebug';
import i18n from '@/lib/i18n';
import { injectMessageFromNotification } from '@/lib/services/NotificationService';

export const useDeepLinking = () => {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;

      // Traitement des notifications via Deep Link (Android Cold/Warm Start)
      if (url.includes('prootapp://notification')) {
        console.log('🚀 [DeepLink] Notification URL détectée:', url);
        try {
          // Extraire les query parameters
          const { queryParams } = Linking.parse(url);
          if (queryParams && Object.keys(queryParams).length > 0) {
            console.log('📦 [DeepLink] Payload extrait:', JSON.stringify(queryParams));
            
            // 1. Injection immédiate dans le store (Zustand)
            await injectMessageFromNotification(queryParams);
            
            // 2. Déclencher le rafraîchissement global (TanStack + UI)
            DeviceEventEmitter.emit('REFRESH_DATA', queryParams);
          }
        } catch (e) {
          console.error('❌ [DeepLink] Erreur traitement notification:', e);
        }
        return;
      }

      // Regex flexible pour capturer les tokens dans query string (?) ou fragment (#)
      const accessTokenMatch = url.match(/[?&#]access_token=([^&]+)/);
      const refreshTokenMatch = url.match(/[?&#]refresh_token=([^&]+)/);

      if (url.includes('confirm-email')) {
        if (accessTokenMatch && refreshTokenMatch) {
          try {
            console.log('🔑 Tokens confirmation trouvés, établissement session...');
            const { data, error } = await supabase.auth.setSession({
              access_token: decodeURIComponent(accessTokenMatch[1]),
              refresh_token: decodeURIComponent(refreshTokenMatch[1]),
            });
            if (error) console.error('❌ Erreur session confirm-email:', error);
            else {
              console.log('✅ Session établie pour confirm-email');
              logSessionSnapshot('deepLink:confirm-email:setSession', data.session);
            }
          } catch (e) {
            console.error('❌ Exception session confirm-email:', e);
          }
        }
        safeReplace(router, '/confirm-email', { skipInitialCheck: false });
      } 
      else if (url.includes('reset-password')) {
        if (accessTokenMatch && refreshTokenMatch) {
          try {
            console.log('🔑 Tokens reset trouvés, établissement session...');
            const { data, error } = await supabase.auth.setSession({
              access_token: decodeURIComponent(accessTokenMatch[1]),
              refresh_token: decodeURIComponent(refreshTokenMatch[1]),
            });
            
            if (error) {
              console.error('❌ Erreur session reset-password:', error);
              Alert.alert(i18n.t('error'), i18n.t('reset_link_invalid'));
              return;
            }
            
            console.log('✅ Session établie pour reset-password');
            logSessionSnapshot('deepLink:reset-password:setSession', data.session);
            safeReplace(router, '/reset-password', { skipInitialCheck: false });
          } catch (err) {
            console.error('❌ Exception session reset-password:', err);
            Alert.alert(i18n.t('error'), i18n.t('reset_link_invalid'));
          }
        } else {
          console.warn('⚠️ Lien reset sans tokens');
          Alert.alert(i18n.t('error'), i18n.t('reset_link_invalid'));
        }
      }
    };

    // 1. Cold Start (App fermée)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // 2. Warm Start (App en arrière-plan)
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [router]);
};
