import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import i18n from './i18n';

const CONSENT_KEY = 'contact_consent_v1';

async function ensureContactConsent(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(CONSENT_KEY);
  // Si le consentement a déjà été accordé, retourner true
  if (stored === 'granted') return true;
  // Si le consentement a déjà été demandé (même refusé), ne plus le redemander
  if (stored === 'denied') return false;

  // Première fois : demander le consentement
  return await new Promise((resolve) => {
    Alert.alert(
      i18n.t('contact_consent_title'),
      i18n.t('contact_consent_message'),
      [
        { 
          text: i18n.t('refuse'), 
          style: 'cancel', 
          onPress: async () => {
            // Stocker le refus pour ne plus redemander
            await AsyncStorage.setItem(CONSENT_KEY, 'denied');
            resolve(false);
          }
        },
        { 
          text: i18n.t('accept'), 
          onPress: async () => {
            await AsyncStorage.setItem(CONSENT_KEY, 'granted');
            resolve(true);
          }
        },
      ],
      { cancelable: false }
    );
  });
}

export async function ensureContactPermissionWithDisclosure(): Promise<Contacts.PermissionStatus> {
  const consent = await ensureContactConsent();
  if (!consent) return 'denied';

  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status;
  } catch (e) {
    return 'denied';
  }
}


