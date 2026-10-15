import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import i18n from './i18n';

export const CONTACT_CONSENT_KEY = 'contact_consent_v1';

/**
 * Affiche la boîte de dialogue de Divulgation Bien Visible (Prominent Disclosure)
 * requise par la Politique Relative aux Données de l'Utilisateur de Google Play Store.
 */
export async function showContactProminentDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('contact_consent_title'),
      i18n.t('contact_consent_message'),
      [
        {
          text: i18n.t('contact_consent_refuse') || i18n.t('refuse'),
          style: 'cancel',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(CONTACT_CONSENT_KEY, 'denied');
            } catch (e) {
              console.warn('⚠️ Erreur stockage refus consentement contact:', e);
            }
            resolve(false);
          },
        },
        {
          text: i18n.t('contact_consent_accept') || i18n.t('accept'),
          onPress: async () => {
            try {
              await AsyncStorage.setItem(CONTACT_CONSENT_KEY, 'granted');
            } catch (e) {
              console.warn('⚠️ Erreur stockage acceptation consentement contact:', e);
            }
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
}

/**
 * Demande la permission d'accéder aux contacts avec divulgation bien visible (Prominent Disclosure).
 *
 * Sur Android :
 * Google Play exige impérativement une Divulgation Bien Visible ET un consentement affirmatif
 * avant d'accéder aux contacts ou de les téléverser sur https://utfwujyymaikraaigvuv.supabase.co.
 *
 * Sur iOS :
 * Apple exige que la demande système s'affiche sans alerte intermédiaire bloquante,
 * l'explication étant fournie dans le NSContactsUsageDescription d'Info.plist.
 *
 * @param force Si true, réaffiche la divulgation même si l'utilisateur avait refusé précédemment.
 */
export async function ensureContactPermissionWithDisclosure(force: boolean = false): Promise<Contacts.PermissionStatus> {
  try {
    // 1. Si la permission système est déjà accordée, rien à demander
    const { status: existingStatus } = await Contacts.getPermissionsAsync();
    if (existingStatus === Contacts.PermissionStatus.GRANTED) {
      return Contacts.PermissionStatus.GRANTED;
    }

    // 2. Sur Android : Google Play exige la Divulgation Bien Visible avant la permission système
    if (Platform.OS === 'android') {
      const storedConsent = await AsyncStorage.getItem(CONTACT_CONSENT_KEY);

      // Si déjà refusé et qu'on ne force pas l'affichage (ex: vérification automatique en tâche de fond)
      if (storedConsent === 'denied' && !force) {
        return Contacts.PermissionStatus.DENIED;
      }

      // Si pas encore accordé ou forcé par l'action utilisateur
      if (storedConsent !== 'granted' || force) {
        const consentGranted = await showContactProminentDisclosure();
        if (!consentGranted) {
          return Contacts.PermissionStatus.DENIED;
        }
      }
    }

    // 3. Demander la permission système (direct sur iOS, après consentement sur Android)
    const response = await Contacts.requestPermissionsAsync();
    if (response.status === Contacts.PermissionStatus.GRANTED) {
      await AsyncStorage.setItem(CONTACT_CONSENT_KEY, 'granted').catch(() => {});
      return response.status;
    }

    if (force && !response.canAskAgain) {
      Alert.alert(
        i18n.t('permission_denied_title'),
        i18n.t('contacts_access_required_later'),
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          { text: i18n.t('settings'), onPress: () => Linking.openSettings().catch(() => {}) }
        ]
      );
    }
    return response.status;
  } catch (e) {
    console.warn('⚠️ Erreur lors de la demande de permission contacts:', e);
    return Contacts.PermissionStatus.DENIED;
  }
}
