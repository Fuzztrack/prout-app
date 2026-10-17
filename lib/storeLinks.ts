import { Linking, Platform } from 'react-native';

export const IOS_STORE_URL = 'itms-apps://itunes.apple.com/app/id6758890809';
export const IOS_STORE_WEB_URL = 'https://apps.apple.com/app/id6758890809';
export const ANDROID_STORE_URL = 'market://details?id=com.fuzztrack.proutapp';
export const ANDROID_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.fuzztrack.proutapp';

export function getStoreUrl(): string {
  return Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
}

function getStoreWebUrl(): string {
  return Platform.OS === 'ios' ? IOS_STORE_WEB_URL : ANDROID_STORE_WEB_URL;
}

export async function openStoreForUpdate(): Promise<void> {
  // Pas de canOpenURL : sur iOS il renvoie false si itms-apps n'est pas déclaré
  // dans LSApplicationQueriesSchemes, alors que openURL fonctionne.
  try {
    await Linking.openURL(getStoreUrl());
    return;
  } catch {
    // Pas d'app store (simulateur, store désactivé) → fallback web
  }
  try {
    await Linking.openURL(getStoreWebUrl());
  } catch (e) {
    console.warn('[storeLinks] Unable to open store:', e);
  }
}
