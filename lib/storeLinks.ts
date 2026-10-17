import { Linking, Platform } from 'react-native';

export const IOS_STORE_URL = 'itms-apps://itunes.apple.com/app/id6758890809';
export const ANDROID_STORE_URL = 'market://details?id=com.fuzztrack.proutapp';
export const ANDROID_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.fuzztrack.proutapp';

export function getStoreUrl(): string {
  return Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
}

export async function openStoreForUpdate(): Promise<void> {
  const primary = getStoreUrl();
  try {
    const canOpen = await Linking.canOpenURL(primary);
    if (canOpen) {
      await Linking.openURL(primary);
      return;
    }
  } catch {
    // fallback below
  }
  if (Platform.OS === 'android') {
    await Linking.openURL(ANDROID_STORE_WEB_URL);
  } else {
    await Linking.openURL(primary);
  }
}
