import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { ensureAndroidNotificationChannel } from '@/lib/notifications';
import { hasAcceptedEulaLocally } from '@/lib/eula';
import { registerPushTokenForUser } from '@/lib/pushTokenRegistration';
import { logSessionSnapshot } from '@/lib/authDebug';

export interface InitResult {
  session: any;
  offlineAccess: boolean;
  showOnboarding: boolean;
  showEulaGate: boolean;
}

export const initializeApp = async (): Promise<InitResult> => {
  try {
    // Supabase auto refresh
    supabase.auth.startAutoRefresh();

    // Android Channels
    if (Platform.OS === 'android') {
      ensureAndroidNotificationChannel().catch(() => {});
    }

    // iOS Badge
    if (Platform.OS === 'ios') {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }

    // Parallel loading
    const [sessionResult, wasLoggedIn, onboardingSeen, welcomeSeen, eulaAccepted] = await Promise.all([
      supabase.auth.getSession().catch(err => ({ data: { session: null }, error: err })),
      AsyncStorage.getItem('supabase_was_logged_in'),
      AsyncStorage.getItem('hasSeenOnboarding'),
      AsyncStorage.getItem('hasSeenWelcome'),
      hasAcceptedEulaLocally(),
    ]);

    const session = sessionResult.data?.session;
    logSessionSnapshot('init:getSession', session);

    let offlineAccess = false;
    if (session) {
      AsyncStorage.setItem('supabase_was_logged_in', 'true').catch(() => {});
      registerPushTokenForUser(session.user.id).catch(() => {});
    } else if (wasLoggedIn === 'true') {
      console.log('⚡ Mode offline activé (basé sur supabase_was_logged_in)');
      offlineAccess = true;
    }

    // Onboarding migration logic
    if (welcomeSeen === 'true' && onboardingSeen !== 'true') {
      AsyncStorage.setItem('hasSeenOnboarding', 'true').catch(() => {});
    }

    const shouldShowOnboarding =
      (!onboardingSeen || onboardingSeen !== 'true') &&
      (!welcomeSeen || welcomeSeen !== 'true');

    return {
      session,
      offlineAccess,
      showOnboarding: shouldShowOnboarding,
      showEulaGate: !shouldShowOnboarding && !eulaAccepted,
    };
  } catch (err) {
    console.warn('⚠️ Init app error:', err);
    return {
      session: null,
      offlineAccess: false,
      showOnboarding: false,
      showEulaGate: false,
    };
  }
};
