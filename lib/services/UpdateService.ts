import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { supabase } from '@/lib/supabase';

const SOFT_DISMISS_KEY = 'soft_update_dismissed_for_version';

export type AppRemoteConfig = {
  latest_version: string;
  soft_update_message?: string | null;
};

export type StartupUpdateResult =
  | { kind: 'ota' }
  | { kind: 'store'; latestVersion: string; message?: string | null }
  | { kind: 'none' };

export function getAppVersion(): string {
  // Version du binaire store en priorité : expoConfig.version reflète le manifest OTA,
  // pas la version réellement installée.
  return (
    Constants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    '0.0.0'
  );
}

/** Compare semver-like versions. Returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d < 0) return -1;
    if (d > 0) return 1;
  }
  return 0;
}

export async function dismissSoftUpdateFor(latestVersion: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SOFT_DISMISS_KEY, latestVersion);
  } catch {
    // ignore
  }
}

async function fetchAppRemoteConfig(): Promise<AppRemoteConfig | null> {
  const { data, error } = await supabase
    .from('app_config')
    .select('latest_version, soft_update_message')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[UpdateService] app_config:', error.message);
    return null;
  }
  if (!data?.latest_version) return null;
  return data as AppRemoteConfig;
}

/**
 * OTA d'abord (prompt reload), sinon soft update store si version < latest.
 * Ne bloque pas le démarrage — à appeler après affichage de l'UI.
 */
export async function checkStartupUpdates(): Promise<StartupUpdateResult> {
  // 1) OTA Expo (ignoré en dev)
  if (!__DEV__ && Updates.isEnabled) {
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await Updates.fetchUpdateAsync();
        return { kind: 'ota' };
      }
    } catch (e) {
      console.warn('[UpdateService] OTA check failed:', e);
    }
  }

  // 2) Soft update store via Supabase
  try {
    const config = await fetchAppRemoteConfig();
    if (config?.latest_version) {
      const current = getAppVersion();
      if (compareVersions(current, config.latest_version) < 0) {
        const dismissed = await AsyncStorage.getItem(SOFT_DISMISS_KEY);
        if (dismissed !== config.latest_version) {
          return {
            kind: 'store',
            latestVersion: config.latest_version,
            message: config.soft_update_message,
          };
        }
      }
    }
  } catch (e) {
    console.warn('[UpdateService] Store check failed:', e);
  }

  return { kind: 'none' };
}

export async function applyOtaUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (e) {
    console.warn('[UpdateService] reloadAsync failed:', e);
  }
}
