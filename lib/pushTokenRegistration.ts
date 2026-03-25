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

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const pushToken = await getFCMToken();
  if (!pushToken) return;

  await supabase
    .from('user_profiles')
    .update(EMPTY_PUSH_PAYLOAD)
    .eq('expo_push_token', pushToken)
    .neq('id', userId);

  const updatePayload: Record<string, unknown> = {
    expo_push_token: pushToken,
    push_platform: Platform.OS,
    push_ios_bundle: null,
  };

  if (Platform.OS === 'ios') {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
    if (bundleId) updatePayload.push_ios_bundle = bundleId;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) {
    throw error;
  }
}
