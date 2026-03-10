import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const EULA_ACCEPTED_KEY = 'eula_accepted';
export const EULA_VERSION = '2026-02-10';

type UserMetadataMap = Record<string, unknown>;

const asMetadataMap = (value: unknown): UserMetadataMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as UserMetadataMap;
};

export const hasAcceptedEulaLocally = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(EULA_ACCEPTED_KEY);
  return value === 'true';
};

export const setLocalEulaAccepted = async () => {
  await AsyncStorage.setItem(EULA_ACCEPTED_KEY, 'true');
};

export const buildAcceptedEulaMetadata = (
  existingMetadata?: unknown,
  acceptedAt: string = new Date().toISOString(),
) => ({
  ...asMetadataMap(existingMetadata),
  eula_accepted: true,
  eula_accepted_at: acceptedAt,
  eula_version: EULA_VERSION,
});

export const isUserEulaAccepted = (user: User | null | undefined): boolean => {
  if (!user) return false;

  const metadata = asMetadataMap(user.user_metadata);
  return (
    metadata.eula_accepted === true &&
    typeof metadata.eula_accepted_at === 'string' &&
    metadata.eula_version === EULA_VERSION
  );
};

export const syncLocalEulaAcceptanceFromUser = async (user: User | null | undefined) => {
  if (isUserEulaAccepted(user)) {
    await setLocalEulaAccepted();
  }
};

export const acceptEulaForCurrentUser = async () => {
  const acceptedAt = new Date().toISOString();

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // AuthSessionMissingError = pas de session active (pré-inscription)
      // On sauvegarde juste en local et on sort proprement
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        await setLocalEulaAccepted();
        return null;
      }
      throw error;
    }
    user = data.user;
  } catch (e: any) {
    if (e?.message?.includes('Auth session missing') || e?.name === 'AuthSessionMissingError') {
      await setLocalEulaAccepted();
      return null;
    }
    throw e;
  }

  if (!user) {
    await setLocalEulaAccepted();
    return null;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: buildAcceptedEulaMetadata(user.user_metadata, acceptedAt),
  });

  if (updateError) {
    throw updateError;
  }

  await setLocalEulaAccepted();

  const {
    data: { user: refreshedUser },
    error: refreshError,
  } = await supabase.auth.getUser();

  if (refreshError) {
    throw refreshError;
  }

  return refreshedUser;
};
