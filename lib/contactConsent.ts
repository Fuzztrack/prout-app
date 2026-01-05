import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Contacts from 'expo-contacts';

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
      'Contacts : utilisation et partage',
      "Cette appli synchronise vos contacts (numéros et noms) vers nos serveurs Supabase (https://utfwujyymaikraaigvuv.supabase.co) pour trouver vos amis et créer les liens d'amitié. Aucune autre utilisation ni partage externe.\n\nAcceptez-vous cette synchronisation ?",
      [
        { 
          text: 'Refuser', 
          style: 'cancel', 
          onPress: async () => {
            // Stocker le refus pour ne plus redemander
            await AsyncStorage.setItem(CONSENT_KEY, 'denied');
            resolve(false);
          }
        },
        { 
          text: 'Accepter', 
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


